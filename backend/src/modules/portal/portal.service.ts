import { Injectable, NotFoundException, ConflictException, BadRequestException, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma, DocumentType, LoanStatus } from '@prisma/client';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { groups, PortalFile, validatePortalData, validatePortalFile } from './portal.validation';
import { assertPreviewEnabled, validateDraftV2, validateCoverage, getFormConfig, checklistFor, LEGACY_CHECKLIST_VERSION, PREVIEW_CHECKLIST_VERSION } from './portal.foundation';
import { evaluatePolicy, resolveTestPolicy, type PortalPolicyContext } from './portal.policy';
import { createV2Snapshot, readV2Snapshot, sameJson } from './portal.snapshot';
import { assessReadiness, companyReadiness, mvpPolicy } from './portal.readiness';

const documentSelect={id:true,documentGroup:true,fileName:true,fileSize:true,uploadedAt:true,coverage:true,version:true,supersedesId:true,withdrawnAt:true};
const officerSelect={id:true,fullName:true,username:true};
const activeDocuments={withdrawnAt:null,nextVersion:{is:null}};
const include={documents:{where:activeDocuments,select:documentSelect},account:{select:{id:true,email:true,contactName:true,phone:true}},assignedOfficer:{select:officerSelect}};
const documentTypes: Record<string,DocumentType>={A:DocumentType.PHAP_LY,B:DocumentType.TAI_CHINH,C:DocumentType.HOAT_DONG_SX,D:DocumentType.PHUONG_AN,E:DocumentType.TSBD,F:DocumentType.DU_NO};
@Injectable()
export class PortalService {
  private readonly dir=join(process.cwd(),'uploads');
  constructor(private prisma:PrismaService,@Optional() @Inject('PORTAL_POLICY_CONTEXT') private policyContext?:PortalPolicyContext) {}
  formConfig() {
    const config={...getFormConfig(),mvpPolicy};
    try {const policy=resolveTestPolicy(this.policyContext);return {...config,canSubmit:true,canAccept:true,submitPolicyVersion:policy.version,readinessVersion:policy.readinessVersion,policyStatus:'TEST_ONLY'};}
    catch(error) {if(!(error instanceof ConflictException)) throw error;return {...config,canAccept:false,submitPolicyVersion:null};}
  }
  async checklist(id:string,accountId:string) {
    const request=await this.one(id,accountId),base=checklistFor(request);
    if(request.formVersion!==2 || request.status!=='DRAFT') return base;
    try {const policy=resolveTestPolicy(this.policyContext);const result=evaluatePolicy(policy,request.data,request.documents,'SUBMIT');return {...base,policyStatus:'TEST_ONLY',cannotSubmit:result.missing.length>0 || result.formErrors.length>0,requirements:result.requirements,missing:result.missing,formErrors:result.formErrors,submitPolicyVersion:policy.version};}
    catch(error) {if(!(error instanceof ConflictException)) throw error;return base;}
  }
  private body(body:any,keys:string[]) {
    if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>!keys.includes(k))) throw new BadRequestException('Thông tin yêu cầu không hợp lệ.');
  }
  private revision(r:{formVersion?:number,revision?:number},expected:unknown) {
    if(expected===undefined && r.formVersion!==2) return;
    if(typeof expected!=='number' || !Number.isSafeInteger(expected) || expected<0) throw new BadRequestException('Cần expectedRevision hợp lệ.');
    if(expected!==(r.revision??0)) throw new ConflictException('Bản nháp đã thay đổi. Vui lòng tải lại trước khi lưu.');
  }
  private legacyOnly(r:{formVersion?:number,checklistVersion?:string}) {
    if((r.formVersion??1)!==1 || (r.checklistVersion??LEGACY_CHECKLIST_VERSION)!==LEGACY_CHECKLIST_VERSION) throw new ConflictException('Chờ chốt chính sách checklist trước khi gửi hoặc tiếp nhận hồ sơ phiên bản mới.');
  }
  private async intakeScope(user?:{id:string,roles:string[]}):Promise<Prisma.PortalRequestWhereInput> {
    if(!user?.roles.includes('CBTD')) return {status:{in:['SUBMITTED','ASSIGNED','ACCEPTED']}};
    return {OR:[{status:'ASSIGNED',assignedTo:user.id},{status:'ACCEPTED',loan:{is:{assignedTo:user.id}}}]};
  }
  async list(accountId?:string,user?:{id:string,roles:string[]}) {return this.prisma.portalRequest.findMany({where:accountId?{accountId}:await this.intakeScope(user),include,orderBy:{createdAt:'desc'}});}
  async one(id:string,accountId?:string,user?:{id:string,roles:string[]}) {
    const r=await this.prisma.portalRequest.findFirst({where:{id,...(accountId?{accountId}:await this.intakeScope(user))},include});
    if(!r) throw new NotFoundException('Không tìm thấy yêu cầu.');
    return r;
  }
  async create(accountId:string,body:any) {
    this.body(body,['data','formVersion','clientRequestId']);
    const formVersion=body.formVersion??1;
    if(![1,2].includes(formVersion)) throw new BadRequestException('Phiên bản biểu mẫu không hỗ trợ.');
    if(formVersion===2) assertPreviewEnabled();
    const key=body.clientRequestId;
    if(key!==undefined && (formVersion!==2 || typeof key!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))) throw new BadRequestException('clientRequestId chỉ hỗ trợ UUIDv4 cho bản nháp v2.');
    const createData=()=>({accountId,reference:`DN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${randomUUID().slice(0,12).toUpperCase()}`,data:formVersion===2?validateDraftV2(body.data??{}):validatePortalData(body.data??{}),formVersion,checklistVersion:formVersion===2?PREVIEW_CHECKLIST_VERSION:LEGACY_CHECKLIST_VERSION});
    if(key===undefined) return this.prisma.portalRequest.create({data:createData(),include});
    const id=key.toLowerCase();
    const conflict=()=>new ConflictException('Không thể tạo bản nháp với mã yêu cầu này.');
    try {
      return await this.prisma.$transaction(async tx=>{
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`portal-create:${accountId}:${id}`}))::text`;
        const existing=await tx.portalRequest.findUnique({where:{id},include});
        if(existing) {
          if(existing.accountId!==accountId || existing.formVersion!==2) throw conflict();
          return existing;
        }
        return tx.portalRequest.create({data:{...createData(),id},include});
      });
    } catch(error) {
      // Different owners use different locks; an ID collision can still race the insert.
      if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2002') throw conflict();
      throw error;
    }
  }
  private async locked(tx:Prisma.TransactionClient,id:string,accountId:string) {
    await tx.$queryRaw`SELECT id FROM portal_requests WHERE id=${id} AND account_id=${accountId} FOR UPDATE`;
    const r=await tx.portalRequest.findFirst({where:{id,accountId},include});
    if(!r) throw new NotFoundException('Không tìm thấy yêu cầu.');
    return r;
  }
  private draft(status:string) {if(status!=='DRAFT') throw new ConflictException('Yêu cầu đã gửi, không thể chỉnh sửa.');}
  async update(id:string,accountId:string,body:any) {
    this.body(body,['data','expectedRevision']);
    return this.prisma.$transaction(async tx=> {
      const r=await this.locked(tx,id,accountId);this.draft(r.status);
      if(r.formVersion===2) assertPreviewEnabled();
      this.revision(r,body.expectedRevision);
      const data=r.formVersion===2?validateDraftV2(body.data):validatePortalData(body.data);
      return tx.portalRequest.update({where:{id},data:{data,revision:(r.revision??0)+1},include});
    });
  }
  async upload(id:string,accountId:string,group:string,file:PortalFile,options:any={},supersedesId?:string) {
    this.body(options,['coverage','clientUploadId','expectedRevision']);
    const initial=await this.one(id,accountId);this.draft(initial.status);
    const v2=initial.formVersion===2;
    if(v2) assertPreviewEnabled();
    if(!v2 && (supersedesId || Object.keys(options).length)) throw new BadRequestException('Metadata phiên bản mới chỉ dùng cho bản nháp v2.');
    const coverage=v2?validateCoverage(group,options.coverage):undefined;
    if(v2 && (typeof options.clientUploadId!=='string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(options.clientUploadId))) throw new BadRequestException('Cần clientUploadId hợp lệ để tải tệp an toàn khi thử lại.');
    const meta=await validatePortalFile(group,file);
    const contentHash=createHash('sha256').update(file.buffer).update(JSON.stringify({group,coverage,fileName:meta.fileName,supersedesId:supersedesId??null})).digest('hex');
    const key=randomUUID();await mkdir(this.dir,{recursive:true});await writeFile(join(this.dir,key),file.buffer,{flag:'wx'});
    let retained=false;
    try {
      return await this.prisma.$transaction(async tx=> {
        const r=await this.locked(tx,id,accountId);this.draft(r.status);
        if(v2) {
          const retry=await tx.portalDocument.findUnique({where:{requestId_clientUploadId:{requestId:id,clientUploadId:options.clientUploadId}}});
          if(retry) {
            if(retry.contentHash!==contentHash) throw new ConflictException('clientUploadId đã dùng cho nội dung khác.');
            return r;
          }
          this.revision(r,options.expectedRevision);
        }
        if(!supersedesId && r.documents.length>=60) throw new BadRequestException('Tối đa 60 tệp hiện hành cho mỗi yêu cầu.');
        let previous:typeof r.documents[number]|undefined;
        if(supersedesId) {
          previous=r.documents.find(d=>d.id===supersedesId);
          if(!previous) throw new ConflictException('Tệp cần thay thế không còn là phiên bản hiện hành.');
          if(previous.documentGroup!==group) throw new BadRequestException('Tệp thay thế phải giữ nhóm chứng từ.');
        }
        await tx.portalDocument.create({data:{requestId:id,documentGroup:group,fileName:meta.fileName,mimeType:meta.mimeType,fileSize:file.size,filePath:key,...(v2?{coverage:coverage as Prisma.InputJsonValue,clientUploadId:options.clientUploadId,contentHash,supersedesId,version:(previous?.version??0)+1}:{})}});
        await tx.portalRequest.update({where:{id},data:{revision:(r.revision??0)+1}});
        retained=true;
        return tx.portalRequest.findUniqueOrThrow({where:{id},include});
      });
    } catch(e) {retained=false;throw e;}
    finally {if(!retained) await unlink(join(this.dir,key)).catch(()=>undefined);}
  }
  async deleteDocument(id:string,accountId:string,documentId:string,expectedRevision?:number) {
    const result=await this.prisma.$transaction(async tx=> {
      const r=await this.locked(tx,id,accountId);this.draft(r.status);
      if(r.formVersion===2) assertPreviewEnabled();
      this.revision(r,expectedRevision);
      const d=await tx.portalDocument.findFirst({where:{id:documentId,requestId:id,...activeDocuments}});
      if(!d) throw new NotFoundException('Không tìm thấy tệp.');
      if(r.formVersion===2) await tx.portalDocument.update({where:{id:documentId},data:{withdrawnAt:new Date()}});
      else await tx.portalDocument.delete({where:{id:documentId}});
      await tx.portalRequest.update({where:{id},data:{revision:(r.revision??0)+1}});
      return {document:d,keep:r.formVersion===2,request:await tx.portalRequest.findUniqueOrThrow({where:{id},include})};
    });
    if(!result.keep) await unlink(join(this.dir,result.document.filePath)).catch(()=>undefined);
    return result.request;
  }
  async documentVersions(id:string,accountId:string,documentId:string) {
    await this.one(id,accountId);
    const all=await this.prisma.portalDocument.findMany({where:{requestId:id},select:documentSelect});
    const target=all.find(d=>d.id===documentId);
    if(!target) throw new NotFoundException('Không tìm thấy tệp.');
    const byId=new Map(all.map(d=>[d.id,d]));const chain=new Set<string>();
    let current:typeof target|undefined=target;
    while(current && !chain.has(current.id)) {chain.add(current.id);current=current.supersedesId?byId.get(current.supersedesId):undefined;}
    let changed=true;
    while(changed) {changed=false;for(const d of all) if(d.supersedesId && chain.has(d.supersedesId) && !chain.has(d.id)) {chain.add(d.id);changed=true;}}
    return all.filter(d=>chain.has(d.id)).sort((a,b)=>a.version-b.version);
  }
  async documentHeads(id:string,accountId:string) {
    await this.one(id,accountId);
    return this.prisma.portalDocument.findMany({where:{requestId:id,nextVersion:{is:null}},select:documentSelect,orderBy:{uploadedAt:'desc'}});
  }
  async download(id:string,documentId:string,accountId?:string,user?:{id:string,roles:string[]}) {
    const request=await this.one(id,accountId,user);
    const frozen=!accountId && request.formVersion===2 ? readV2Snapshot(request).documents.find(d=>d.id===documentId) : undefined;
    if(!accountId && request.formVersion===2 && !frozen) throw new NotFoundException('Tệp không thuộc snapshot đề nghị đã gửi.');
    const d=await this.prisma.portalDocument.findFirst({where:{id:documentId,requestId:id}});
    if(!d || basename(d.filePath)!==d.filePath) throw new NotFoundException('Không tìm thấy tệp.');
    let buffer:Buffer;
    try {buffer=await readFile(join(this.dir,d.filePath));}
    catch {throw new NotFoundException('Không tìm thấy tệp đã lưu.');}
    if(frozen && (buffer.length!==frozen.fileSize || createHash('sha256').update(buffer).digest('hex')!==frozen.sha256
      || !sameJson({id:d.id,documentGroup:d.documentGroup,fileName:d.fileName,fileSize:d.fileSize,mimeType:d.mimeType,uploadedAt:new Date(d.uploadedAt).toISOString(),coverage:d.coverage,version:d.version,contentHash:d.contentHash??null},
        {id:frozen.id,documentGroup:frozen.documentGroup,fileName:frozen.fileName,fileSize:frozen.fileSize,mimeType:frozen.mimeType,uploadedAt:frozen.uploadedAt,coverage:frozen.coverage,version:frozen.version,contentHash:frozen.contentHash}))) throw new ConflictException('Chứng từ không khớp snapshot đã gửi; chưa thể tải để kiểm tra.');
    return {buffer,fileName:frozen?.fileName??d.fileName};
  }
  private async physicalFiles(documents:any[]) {
    return Promise.all(documents.map(async d=>{
      if(basename(d.filePath)!==d.filePath) throw new ConflictException('Đường dẫn chứng từ không hợp lệ.');
      let buffer:Buffer;try {buffer=await readFile(join(this.dir,d.filePath));} catch {throw new ConflictException('Không tìm thấy chứng từ đã lưu; chưa thể gửi hoặc tiếp nhận.');}
      if(buffer.length!==d.fileSize) throw new ConflictException('Dung lượng chứng từ không đồng nhất.');
      await validatePortalFile(d.documentGroup,{buffer,originalname:d.fileName,size:buffer.length,mimetype:d.mimeType});
      return {...d,sha256:createHash('sha256').update(buffer).digest('hex')};
    }));
  }
  private submitManifest(body:any,revision:number,documentIds:string[]) {
    this.body(body,['expectedRevision','documentIds']);
    if(!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision<0 || !Array.isArray(body.documentIds) || body.documentIds.some((id:unknown)=>typeof id!=='string') || new Set(body.documentIds).size!==body.documentIds.length) throw new BadRequestException('Cần revision và danh sách tài liệu đã tải hoàn tất.');
    if(body.expectedRevision!==revision || !sameJson([...body.documentIds].sort(),[...documentIds].sort())) throw new ConflictException('Bản nháp hoặc danh sách tài liệu đã thay đổi. Vui lòng tải lại và rà soát.');
  }
  async submit(id:string,accountId:string,body?:any) {
    return this.prisma.$transaction(async tx=> {
      const r=await this.locked(tx,id,accountId);
      if(r.formVersion===2) {
        const currentPolicy=resolveTestPolicy(this.policyContext);
        if(r.status!=='DRAFT') {const snapshot=readV2Snapshot(r);this.submitManifest(body,snapshot.revision,snapshot.documents.map(d=>d.id));return r;}
        this.submitManifest(body,r.revision,r.documents.map(d=>d.id));
        const evaluation=evaluatePolicy(currentPolicy,r.data,r.documents,'SUBMIT');
        if(evaluation.formErrors.length || evaluation.missing.length) throw new BadRequestException([...evaluation.formErrors,...evaluation.missing.map(item=>`Thiếu tài liệu: ${item}`)].join('\n'));
        const all=await tx.portalDocument.findMany({where:{requestId:id,...activeDocuments}});
        const docs=await this.physicalFiles(all);
        const now=new Date(),snapshot=createV2Snapshot(r,currentPolicy,evaluation.requirements,docs,now);
        const request=await tx.portalRequest.update({where:{id},data:{status:'SUBMITTED',submittedAt:now,checklistVersion:currentPolicy.version,checklistSnapshot:snapshot as unknown as Prisma.InputJsonValue},include});
        const managers=await tx.user.findMany({where:{isActive:true,roles:{some:{role:{code:'QUAN_LY'}}}},select:{id:true}});
        if(managers.length) await tx.internalNotification.createMany({data:managers.map(manager=>({userId:manager.id,requestId:id,title:'Đề nghị doanh nghiệp chờ phân công',message:`Đề nghị ${r.reference} đã gửi, đang chờ phân công CBTD.`}))});
        return request;
      }
      if(r.status!=='DRAFT') return r;
      this.legacyOnly(r);
      validatePortalData(r.data,true);
      if(groups.some(g=>!r.documents.some(d=>d.documentGroup===g))) throw new BadRequestException('Cần tải ít nhất một tệp cho mỗi nhóm A, B, C, D, E, F.');
      const request=await tx.portalRequest.update({where:{id},data:{status:'SUBMITTED',submittedAt:new Date(),checklistSnapshot:{version:LEGACY_CHECKLIST_VERSION,formVersion:1,groups:[...groups],documentIds:r.documents.map(d=>d.id)}},include});
      const managers=await tx.user.findMany({where:{isActive:true,roles:{some:{role:{code:'QUAN_LY'}}}},select:{id:true}});
      if(managers.length) await tx.internalNotification.createMany({data:managers.map(manager=>({userId:manager.id,requestId:id,title:'Đề nghị doanh nghiệp chờ phân công',message:`Đề nghị ${r.reference} đã gửi, đang chờ phân công CBTD.`}))});
      return request;
    },{timeout:30000});
  }
  async companyMatch(id:string,user?:{id:string,roles:string[]}) {
    const r=await this.one(id,undefined,user);
    const data=r.data as Record<string,any>;
    const company=await this.prisma.company.findUnique({where:{taxCode:data.taxCode}});
    return {found:!!company,company,...(company&&r.formVersion===2?{financialReadiness:companyReadiness(data,company)}:{})};
  }
  async readiness(id:string,accountId?:string,user?:{id:string,roles:string[]}) {
    const request=await this.one(id,accountId,user);
    return request.formVersion===2?assessReadiness(request.data as Record<string,any>,request.documents):{version:'V1',dataReady:null,canSubmit:false,issues:[],note:'Hồ sơ V1 giữ luồng cũ.'};
  }
  async officers() {
    const officers=await this.prisma.user.findMany({where:{isActive:true,roles:{some:{role:{code:'CBTD'}}}},select:officerSelect,orderBy:{fullName:'asc'}});
    const activeStatuses:LoanStatus[]=['RECEIVED','CHECKED','SUPPLEMENT_REQUIRED','PENDING_APPRAISAL','WAITING_HEAD_OFFICE'];
    return Promise.all(officers.map(async officer=>({...officer,
      activeLoanCount:await this.prisma.loanApplication.count({where:{assignedTo:officer.id,currentStatus:{in:activeStatuses}}}),
      pendingIntakeCount:await this.prisma.portalRequest.count({where:{assignedTo:officer.id,status:'ASSIGNED'}}),
    })));
  }
  async assignmentHistory(id:string,user:{id:string,roles:string[]}) {
    await this.one(id,undefined,user);
    return this.prisma.portalAssignment.findMany({where:{requestId:id},select:{id:true,fromUser:{select:officerSelect},toUser:{select:officerSelect},manager:{select:officerSelect},note:true,assignedAt:true},orderBy:[{assignedAt:'desc'},{id:'desc'}]});
  }
  async assign(id:string,body:any,managerId:string) {
    if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>!['officerId','expectedAssignedTo','note'].includes(key)) || typeof body.officerId!=='string' || !body.officerId.trim() || !Object.prototype.hasOwnProperty.call(body,'expectedAssignedTo') || (body.expectedAssignedTo!==null && (typeof body.expectedAssignedTo!=='string' || !body.expectedAssignedTo.trim())) || (body.note!==undefined && (typeof body.note!=='string' || body.note.length>2000))) throw new BadRequestException('Thông tin phân công không hợp lệ.');
    const note=body.note?.trim() || null;
    return this.prisma.$transaction(async tx=> {
      await tx.$queryRaw`SELECT id FROM portal_requests WHERE id=${id} FOR UPDATE`;
      const r=await tx.portalRequest.findUnique({where:{id},include});
      if(!r || r.status==='DRAFT') throw new NotFoundException('Không tìm thấy yêu cầu đã gửi.');
      if(r.status==='ACCEPTED') throw new ConflictException('Yêu cầu đã tiếp nhận; điều chuyển tại hồ sơ vay.');
      if(r.assignedTo!==body.expectedAssignedTo) throw new ConflictException('Phân công đã thay đổi. Vui lòng tải lại yêu cầu.');
      const officer=await tx.user.findFirst({where:{id:body.officerId,isActive:true,roles:{some:{role:{code:'CBTD'}}}},select:{id:true}});
      if(!officer) throw new BadRequestException('Cán bộ nhận phải là CBTD đang hoạt động.');
      if(r.assignedTo===body.officerId) return r;
      if(r.assignedTo && !note) throw new BadRequestException('Cần ghi lý do điều chuyển.');
      const now=new Date();
      const request=await tx.portalRequest.update({where:{id},data:{status:'ASSIGNED',assignedTo:body.officerId,assignedBy:managerId,assignedAt:now},include});
      await tx.portalAssignment.create({data:{requestId:id,fromUserId:r.assignedTo,toUserId:body.officerId,managerId,note,assignedAt:now}});
      const notices=[{userId:body.officerId,requestId:id,title:'Đề nghị được phân công',message:`Bạn được giao đề nghị ${r.reference}. Vui lòng kiểm tra và tiếp nhận.`}];
      if(r.assignedTo) notices.push({userId:r.assignedTo,requestId:id,title:'Đề nghị đã điều chuyển',message:`Đề nghị ${r.reference} đã được chuyển sang CBTD khác.`});
      await tx.internalNotification.createMany({data:notices});
      return request;
    });
  }
  async accept(id:string,userId:string,confirmExistingCompany=false,confirmExistingCompanyFinancials=false) {
    return this.prisma.$transaction(async tx=> {
      await tx.$queryRaw`SELECT id FROM portal_requests WHERE id=${id} FOR UPDATE`;
      const r=await tx.portalRequest.findUnique({where:{id},include:{documents:{where:activeDocuments}}});
      if(!r || r.status==='DRAFT') throw new NotFoundException('Không tìm thấy yêu cầu đã gửi.');
      if(r.status==='ACCEPTED') {
        const loan=r.loanId ? await tx.loanApplication.findFirst({where:{id:r.loanId,assignedTo:userId},select:{id:true}}) : null;
        if(!loan) throw new NotFoundException('Hồ sơ đã được điều chuyển hoặc không còn trong phạm vi phụ trách.');
        return {loanId:r.loanId,request:await tx.portalRequest.findUniqueOrThrow({where:{id},include})};
      }
      if(r.status!=='ASSIGNED' || r.assignedTo!==userId) throw new NotFoundException('Không tìm thấy yêu cầu được phân công.');
      let data:Record<string,any>,intakeDocuments=r.documents;
      if(r.formVersion===2) {
        resolveTestPolicy(this.policyContext);
        const snapshot=readV2Snapshot(r);
        const evaluation=evaluatePolicy(snapshot.policy,snapshot.data,snapshot.documents,'INTAKE');
        if(evaluation.missing.length || evaluation.formErrors.length) throw new BadRequestException('Snapshot chưa đủ điều kiện tiếp nhận theo policy đã chốt lúc gửi.');
        const physical=await this.physicalFiles(intakeDocuments);
        const actual=physical.map(d=>({id:d.id,documentGroup:d.documentGroup,fileName:d.fileName,fileSize:d.fileSize,mimeType:d.mimeType,uploadedAt:d.uploadedAt.toISOString(),coverage:d.coverage,version:d.version,contentHash:d.contentHash??null,sha256:d.sha256}));
        const ordered=(items:any[])=>[...items].sort((a,b)=>a.id.localeCompare(b.id));
        if(!sameJson(ordered(actual),ordered(snapshot.documents))) throw new ConflictException('Chứng từ hiện có khác snapshot đã gửi; chưa thể tiếp nhận.');
        const companyFields=['taxCode','companyName','industry','establishedYear','annualRevenue','charterCapital','representativeName','phone','address','loanPurpose','loanType','proposedAmount','loanTermMonths'];
        data=validatePortalData(Object.fromEntries(companyFields.filter(key=>snapshot.data[key]!==undefined).map(key=>[key,snapshot.data[key]])),true);
      } else {
        this.legacyOnly(r);data=validatePortalData(r.data,true);
        const frozen=r.checklistSnapshot as any;
        if(frozen?.documentIds && !sameJson([...frozen.documentIds].sort(),intakeDocuments.map(d=>d.id).sort())) throw new ConflictException('Tài liệu V1 không khớp snapshot đã gửi.');
      }
      // Serialize by tax code as well: two distinct intakes must not race creating a company.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.taxCode}))::text`;
      let company=await tx.company.findUnique({where:{taxCode:data.taxCode}});
      if(company && !confirmExistingCompany) throw new ConflictException('Mã số thuế đã tồn tại. Cần xác nhận liên kết doanh nghiệp hiện có; thông tin hiện có sẽ được giữ nguyên.');
      let financialReview='';
      if(company && r.formVersion===2 && readV2Snapshot(r).policy.readinessVersion==='MVP1'){
        const comparison=companyReadiness(data,company);
        if(!comparison.compatible) throw new ConflictException(comparison.message);
        if(!confirmExistingCompanyFinancials) throw new ConflictException('CBTD cần xác nhận đã đối chiếu kỳ và nguồn dữ liệu tài chính Company hiện hữu. Không tự ghi đè.');
        financialReview=`; CBTD ${userId} xác nhận đối chiếu tài chính Company ${company.id}, kỳ ${String((r.data as any).revenuePeriod)}, nguồn ${String((r.data as any).annualRevenueBasis?.documentId)}`;
      }
      const {loanPurpose,loanType,proposedAmount,loanTermMonths}=data;
      const companyData=Object.fromEntries(['taxCode','companyName','industry','establishedYear','annualRevenue','charterCapital','representativeName','phone','address'].map(key=>[key,data[key]]));
      if(!company) company=await tx.company.create({data:companyData as Prisma.CompanyCreateInput});
      const stage=await tx.workflowStage.findUnique({where:{stageCode:'TIEP_NHAN'}});
      if(!stage) throw new BadRequestException('Chưa cấu hình công đoạn Tiếp nhận.');
      const now=new Date();
      const loan=await tx.loanApplication.create({data:{applicationCode:`SME-${now.toISOString().slice(0,10).replace(/-/g,'')}-${randomUUID().replace(/-/g,'').slice(0,12).toUpperCase()}`,companyId:company.id,loanPurpose,loanType,proposedAmount,loanTermMonths,assignedTo:userId,currentStage:'TIEP_NHAN',currentStatus:'RECEIVED',stageHistories:{create:{stageId:stage.id,enteredAt:now,slaStandardHours:stage.standardSlaHours,handledBy:userId,notes:`Tiếp nhận yêu cầu doanh nghiệp ${r.reference}${financialReview}`}}}});
      await tx.document.createMany({data:r.documents.map(d=>({applicationId:loan.id,documentType:documentTypes[d.documentGroup],fileName:d.fileName,filePath:d.filePath,fileSize:d.fileSize,mimeType:d.mimeType,uploadedBy:userId,uploadedAt:d.uploadedAt,portalDocumentId:d.id}))});
      const request=await tx.portalRequest.update({where:{id},data:{status:'ACCEPTED',acceptedAt:now,acceptedBy:userId,loanId:loan.id},include});
      return {loanId:loan.id,request};
    },{timeout:15000});
  }
}
