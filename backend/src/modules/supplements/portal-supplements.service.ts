import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../../prisma.service';
import { PortalFile, validatePortalFile } from '../portal/portal.validation';
import { metadata, revision, replay, review, respond, heads, safeView } from './portal-supplement';
import { closeStagePause, openStagePause } from '../workflow/sla/sla-policy';

const hash=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
@Injectable()
export class PortalSupplementsService {
  private readonly dir=join(process.cwd(),'uploads','supplements');
  constructor(private prisma:PrismaService) {}
  private body(body:any,keys:string[]) {
    if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>!keys.includes(k))) throw new BadRequestException('Thông tin thao tác không hợp lệ.');
  }
  private async owner(tx:any,requestId:string,accountId:string,applicationId?:string) {
    const r=await tx.portalRequest.findFirst({where:{id:requestId,accountId,status:'ACCEPTED',...(applicationId?{loanId:applicationId}:{})}});
    if(!r?.loanId) throw new NotFoundException('Không tìm thấy hồ sơ đã được tiếp nhận.');return r;
  }
  async list(requestId:string,accountId:string) {
    const r=await this.owner(this.prisma,requestId,accountId);
    return (await this.prisma.supplementRequest.findMany({where:{applicationId:r.loanId},orderBy:{requestedAt:'desc'}})).map(safeView);
  }
  async details(id:string) {
    const r=await this.prisma.supplementRequest.findUnique({where:{id}});
    if(!r) throw new NotFoundException('Không tìm thấy yêu cầu bổ sung.');return safeView(r);
  }
  private async locked(tx:any,id:string,scope?:{requestId:string;accountId:string}) {
    const initial=await tx.supplementRequest.findUnique({where:{id}});
    if(!initial) throw new NotFoundException('Không tìm thấy yêu cầu bổ sung.');
    if(scope) await this.owner(tx,scope.requestId,scope.accountId,initial.applicationId);
    await tx.$queryRaw`SELECT id FROM loan_applications WHERE id=${initial.applicationId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM supplement_requests WHERE id=${id} FOR UPDATE`;
    const r=await tx.supplementRequest.findUnique({where:{id},include:{application:true}});
    if(!r) throw new NotFoundException('Không tìm thấy yêu cầu bổ sung.');
    if(scope) await this.owner(tx,scope.requestId,scope.accountId,r.applicationId);
    return r;
  }
  private pending(r:any) {
    if(r.status!=='PENDING' || r.application.completedAt || r.application.currentStage==='HOAN_TAT') throw new ConflictException('Yêu cầu bổ sung đã kết thúc.');
  }
  private async save(tx:any,r:any,m:any,id:string,kind:string,fingerprint:string) {
    if(m.operations.length>=1000) throw new ConflictException('Yêu cầu đạt giới hạn kỹ thuật lịch sử thao tác. Liên hệ cán bộ; lịch sử được giữ nguyên.');
    m.operations.push({id,kind,hash:fingerprint});m.revision++;
    const result=await tx.supplementRequest.updateMany({where:{id:r.id,status:'PENDING',portalSupplement:{equals:r.portalSupplement}},data:{portalSupplement:m}});
    if(result.count!==1) throw new ConflictException('Dữ liệu đã thay đổi. Vui lòng tải lại.');
    return safeView({...r,portalSupplement:m});
  }
  async review(id:string,itemId:string,body:any,user:{id:string;activeRole:string}) {
    this.body(body,['expectedRevision','clientRequestId','accepted','message']);
    return this.prisma.$transaction(async tx=> {
      const r=await this.locked(tx,id),m=metadata(r),fingerprint=hash({itemId,accepted:body.accepted,message:body.message});
      // The guard runs before this transaction; assignment/stage can change while waiting for the row locks.
      if(!user?.id || (user.activeRole==='CBTD' && r.application.assignedTo!==user.id)) throw new ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
      const expectedRole=r.application.currentStage==='TIEP_NHAN'?'CBTD':'THAM_QUYEN';
      if(user.activeRole!==expectedRole || r.application.completedAt || r.application.currentStage==='HOAN_TAT') throw new ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
      if(replay(m,body.clientRequestId,'review',fingerprint)) return safeView(r);
      this.pending(r);revision(m,body.expectedRevision);review(m,itemId,body);
      m.events[m.events.length-1].actorId=user.id;
      return this.save(tx,r,m,body.clientRequestId,'review',fingerprint);
    });
  }
  /**
   * CBTD (hoặc Thẩm quyền ở công đoạn sau) hoàn tất lượt kiểm tra và gửi danh sách sửa tổng hợp cho doanh nghiệp.
   * Chỉ có tác dụng bắt đầu khoảng chờ doanh nghiệp mới (PA1); không đổi quy tắc tải lại tệp của Portal.
   */
  async returnCorrections(id:string,body:any,user:{id:string;activeRole:string},clock:Date=new Date()) {
    this.body(body,['expectedRevision','clientRequestId']);
    return this.prisma.$transaction(async tx=> {
      const r=await this.locked(tx,id),m=metadata(r),fingerprint=hash({kind:'return'});
      if(!user?.id || (user.activeRole==='CBTD' && r.application.assignedTo!==user.id)) throw new ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
      const expectedRole=r.application.currentStage==='TIEP_NHAN'?'CBTD':'THAM_QUYEN';
      if(user.activeRole!==expectedRole || r.application.completedAt || r.application.currentStage==='HOAN_TAT') throw new ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
      if(replay(m,body.clientRequestId,'return',fingerprint)) return safeView(r);
      this.pending(r);revision(m,body.expectedRevision);
      if(m.items.some(i=>i.status==='SUBMITTED')) throw new ConflictException('Còn mục doanh nghiệp đã gửi chưa được kiểm tra. Hoàn tất kiểm tra trước khi gửi danh sách sửa.');
      if(!m.items.some(i=>i.status==='REPLACE_REQUIRED')) throw new BadRequestException('Không có mục nào cần doanh nghiệp sửa.');
      m.events.push({type:'RETURNED',at:clock.toISOString(),actorId:user.id});
      await openStagePause(tx,r.applicationId,clock,'WAIT_ENTERPRISE',r.id);
      return this.save(tx,r,m,body.clientRequestId,'return',fingerprint);
    });
  }
  async respond(requestId:string,accountId:string,id:string,body:any,clock:Date=new Date()) {
    this.body(body,['expectedRevision','clientRequestId','documentIds']);
    return this.prisma.$transaction(async tx=> {
      const r=await this.locked(tx,id,{requestId,accountId}),m=metadata(r),fingerprint=hash({documentIds:Array.isArray(body.documentIds)?[...body.documentIds].sort():body.documentIds});
      if(replay(m,body.clientRequestId,'respond',fingerprint)) return safeView(r);
      this.pending(r);revision(m,body.expectedRevision);respond(m,body.documentIds);
      // Freeze a manifest only after checking the actual bytes, not metadata alone.
      for(const fileId of body.documentIds) await this.fileBytes(m,m.files.find(f=>f.id===fileId));
      // Doanh nghiệp đã gửi đủ: kết thúc khoảng chờ doanh nghiệp (PA1); ngân hàng kiểm tra tiếp tục tính giờ. Gửi lặp đã được `replay` chặn ở trên.
      await closeStagePause(tx,r.applicationId,clock);
      return this.save(tx,r,m,body.clientRequestId,'respond',fingerprint);
    },{timeout:30000});
  }
  async upload(requestId:string,accountId:string,id:string,itemId:string,file:PortalFile,body:any) {
    this.body(body,['expectedRevision','clientUploadId','supersedesId']);
    if(typeof body.expectedRevision!=='string' || !/^(0|[1-9]\d*)$/.test(body.expectedRevision)) throw new BadRequestException('expectedRevision không hợp lệ.');
    // Establish ownership before validating the file or touching disk.
    const initial=await this.prisma.supplementRequest.findUnique({where:{id}});
    if(!initial) throw new NotFoundException('Không tìm thấy yêu cầu bổ sung.');
    await this.owner(this.prisma,requestId,accountId,initial.applicationId);
    const item=metadata(initial).items.find(i=>i.id===itemId);
    if(!item) throw new NotFoundException('Không tìm thấy mục bổ sung.');
    const meta=await validatePortalFile(item.documentGroup,file);
    const sha256=createHash('sha256').update(file.buffer).digest('hex');
    const fingerprint=hash({itemId,sha256,fileName:meta.fileName,supersedesId:body.supersedesId??null});
    let createdPath:string|undefined,committed=false;
    try {
      const result=await this.prisma.$transaction(async tx=> {
        const r=await this.locked(tx,id,{requestId,accountId}),m=metadata(r);
        if(replay(m,body.clientUploadId,'upload',fingerprint)) return safeView(r);
        this.pending(r);revision(m,Number(body.expectedRevision));
        if(m.files.length>=300 || m.operations.length>=1000) throw new ConflictException('Yêu cầu đạt giới hạn kỹ thuật file/lịch sử. Liên hệ cán bộ; không xóa lịch sử cũ.');
        const current=m.items.find(i=>i.id===itemId);
        if(!current || !['PENDING','REPLACE_REQUIRED'].includes(current.status)) throw new ConflictException('Mục này chưa mở nhận tệp bổ sung.');
        const head=heads(m).find(f=>f.itemId===itemId);
        if((head?.id??undefined)!==(body.supersedesId??undefined)) throw new ConflictException('Phải thay thế đúng phiên bản tệp hiện hành.');
        const key=randomUUID();await mkdir(this.dir,{recursive:true});const path=join(this.dir,key);
        const handle=await open(path,'wx');createdPath=path;
        try {await handle.writeFile(file.buffer);} finally {await handle.close();}
        const at=new Date().toISOString();m.files.push({id:key,itemId,fileName:meta.fileName,mimeType:meta.mimeType,fileSize:file.size,version:(head?.version??0)+1,...(head?{supersedesId:head.id}:{}),uploadedAt:at,filePath:key,sha256});
        m.events.push({type:'UPLOADED',at,itemId});
        return this.save(tx,r,m,body.clientUploadId,'upload',fingerprint);
      });
      committed=true;return result;
    } finally {if(createdPath && !committed) await unlink(createdPath).catch(()=>undefined);}
  }
  async download(id:string,fileId:string,scope?:{requestId:string;accountId:string}) {
    const r=await this.prisma.supplementRequest.findUnique({where:{id}});
    if(!r) throw new NotFoundException('Không tìm thấy yêu cầu bổ sung.');
    if(scope) await this.owner(this.prisma,scope.requestId,scope.accountId,r.applicationId);
    const m=metadata(r),f=m.files.find(f=>f.id===fileId);
    return {buffer:await this.fileBytes(m,f),fileName:f.fileName};
  }
  private async fileBytes(m:any,f:any) {
    if(!f || !/^[0-9a-f-]{36}$/i.test(f.filePath) || f.filePath!==f.id) throw new NotFoundException('Không tìm thấy tệp.');
    let buffer:Buffer;try {buffer=await readFile(join(this.dir,f.filePath));} catch {throw new ConflictException('Không đọc được tệp bổ sung.');}
    if(buffer.length!==f.fileSize || createHash('sha256').update(buffer).digest('hex')!==f.sha256) throw new ConflictException('Nội dung tệp không khớp bản đã lưu.');
    await validatePortalFile(m.items.find((i:any)=>i.id===f.itemId).documentGroup,{buffer,originalname:f.fileName,size:buffer.length,mimetype:f.mimeType});
    return buffer;
  }
}
