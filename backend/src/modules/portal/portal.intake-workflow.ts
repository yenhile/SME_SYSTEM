import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma.service';
import { APPROVED_MVP_POLICY_VERSION, evaluateIntakeReadiness, getApprovedPolicy } from './portal.approved-policy';
import { createV2Snapshot, readV2Snapshot, sameJson, type SubmissionSnapshot } from './portal.snapshot';
import { assertReviewsComplete, carryReviews, intakeChecklist, intakeDigest, type IntakeReview } from './portal.intake-cycle';

type Actor = {id:string;roles:string[]};
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/** All writes lock the parent request first; published snapshots are append-only. */
export class PortalIntakeWorkflow {
  constructor(private db: PrismaService, private include: any, private physicalFiles: (documents:any[])=>Promise<any[]>) {}
  private body(body:any, keys:string[]) {
    if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k=>!keys.includes(k))
      || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision<0 || typeof body.clientRequestId!=='string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.clientRequestId))
      throw new BadRequestException('Cần phiên bản và mã thao tác UUID hợp lệ.');
  }
  private text(value:any, label:string) {
    if(typeof value!=='string' || !value.trim() || value.length>4000) throw new BadRequestException(`Cần ${label}, tối đa 4000 ký tự.`);
    return value.trim();
  }
  private async lock(tx:Prisma.TransactionClient,id:string,actor:Actor|string,managerOnly=false):Promise<any> {
    await tx.$queryRaw`SELECT id FROM portal_requests WHERE id=${id} FOR UPDATE`;
    const r=await tx.portalRequest.findUnique({where:{id},include:this.include});
    const owner=typeof actor==='string';
    const allowed=owner?r?.accountId===actor:managerOnly?actor.roles.includes('QUAN_LY'):
      actor.roles.includes('CBTD')&&r?.assignedTo===actor.id;
    if(!r || !allowed || r.formVersion!==2 || r.status==='DRAFT') throw new NotFoundException('Không tìm thấy đề nghị trong phạm vi xử lý.');
    return r;
  }
  private async operation(tx:Prisma.TransactionClient,r:any,body:any,actorId:string,kind:string) {
    const payloadHash=intakeDigest({kind,body});
    const prior=await tx.portalIntakeOperation.findUnique({where:{requestId_clientRequestId:{requestId:r.id,clientRequestId:body.clientRequestId}}});
    if(prior) {
      if(prior.actorId!==actorId || prior.kind!==kind || prior.payloadHash!==payloadHash) throw new ConflictException('Mã thao tác đã được dùng với nội dung khác.');
      return true;
    }
    if(r.revision!==body.expectedRevision) throw new ConflictException('Đề nghị hoặc kết quả kiểm tra đã đổi; hãy tải lại.');
    await tx.portalIntakeOperation.create({data:{requestId:r.id,clientRequestId:body.clientRequestId,actorId,kind,payloadHash}});
    return false;
  }
  private async latest(tx:Prisma.TransactionClient,id:string):Promise<any> {
    const s=await tx.portalSubmission.findFirst({where:{requestId:id},orderBy:{sequence:'desc'}});
    if(!s) throw new ConflictException('Đề nghị chưa có lần gửi theo quy trình mới.');
    this.snapshot(s);
    return s;
  }
  snapshot(s:any):SubmissionSnapshot {
    const raw=s.snapshot as SubmissionSnapshot;
    return readV2Snapshot({id:s.requestId,accountId:raw?.audit?.actorAccountId,revision:s.sourceRevision,
      checklistVersion:raw?.checklistVersion,submittedAt:s.submittedAt,data:raw?.data,checklistSnapshot:raw});
  }
  async latestSnapshot(id:string) {
    const s=await this.db.portalSubmission.findFirst({where:{requestId:id},orderBy:{sequence:'desc'}});
    return s?this.snapshot(s):null;
  }
  async publish(tx:Prisma.TransactionClient,r:any,body:any):Promise<any> {
    if(!body || Object.keys(body).some(k=>!['expectedRevision','documentIds'].includes(k)) || !Number.isSafeInteger(body.expectedRevision)
      || !Array.isArray(body.documentIds) || body.documentIds.some((x:any)=>typeof x!=='string') || new Set(body.documentIds).size!==body.documentIds.length)
      throw new BadRequestException('Cần phiên bản và danh sách tài liệu đã hoàn tất.');
    const previous=await tx.portalSubmission.findFirst({where:{requestId:r.id},orderBy:{sequence:'desc'}});
    const retry=await tx.portalSubmission.findUnique({where:{requestId_sourceRevision:{requestId:r.id,sourceRevision:body.expectedRevision}}});
    if(retry) {
      if(!sameJson([...body.documentIds].sort(),this.snapshot(retry).documents.map(d=>d.id).sort())) throw new ConflictException('Lần gửi trước có danh sách tài liệu khác.');
      return r;
    }
    if(!['DRAFT','RETURNED'].includes(r.status) || r.revision!==body.expectedRevision) throw new ConflictException('Đề nghị chưa được mở sửa hoặc phiên bản đã đổi.');
    if(previous && this.snapshot(previous).data.taxCode!==r.data.taxCode) throw new ConflictException('Thay chủ thể/MST cần lập đề nghị mới.');
    if(!sameJson([...body.documentIds].sort(),r.documents.map((d:any)=>d.id).sort())) throw new ConflictException('Danh sách tài liệu đã đổi.');
    const now=new Date(),policy=getApprovedPolicy();
    const assessment=evaluateIntakeReadiness(policy,r.data,r.documents,{phase:'SUBMIT',submittedAt:now});
    if(!assessment.dataReady) throw new BadRequestException(assessment.issues.map(i=>i.message).concat(assessment.formErrors).join('\n') || 'Chưa đủ hồ sơ theo checklist.');
    const files=await tx.portalDocument.findMany({where:{requestId:r.id,withdrawnAt:null,nextVersion:{is:null}}});
    const physical=await this.physicalFiles(files);
    const snapshot=createV2Snapshot(r,policy,assessment.requirements,physical,now);
    const items=intakeChecklist(snapshot);
    const reviews=previous?carryReviews(previous.reviews as IntakeReview[],items,previous.id):[];
    const {submissionChanges}=await import('./portal.intake-cycle');
    await tx.portalSubmission.create({data:{requestId:r.id,sequence:(previous?.sequence??0)+1,sourceRevision:r.revision,
      snapshot:json(snapshot),submittedAt:now,reviews:json(reviews),changes:json(submissionChanges(previous?this.snapshot(previous):null,snapshot))}});
    const request=await tx.portalRequest.update({where:{id:r.id},data:{status:r.assignedTo?'ASSIGNED':'SUBMITTED',submittedAt:now,
      checklistVersion:APPROVED_MVP_POLICY_VERSION,checklistSnapshot:json(snapshot),correctionRequest:Prisma.DbNull},include:this.include});
    const recipients=r.assignedTo?[{id:r.assignedTo}]:await tx.user.findMany({where:{isActive:true,roles:{some:{role:{code:'QUAN_LY'}}}},select:{id:true}});
    if(recipients.length) await tx.internalNotification.createMany({data:recipients.map(u=>({userId:u.id,requestId:r.id,title:previous?'Đề nghị đã gửi lại':'Đề nghị chờ phân công',message:`Đề nghị ${r.reference} đã gửi lần ${(previous?.sequence??0)+1}.`}))});
    return request;
  }
  async view(r:any,internal:boolean) {
    const submissions=await this.db.portalSubmission.findMany({where:{requestId:r.id},orderBy:{sequence:'desc'}});
    const issues=await this.db.portalIntakeIssue.findMany({where:{requestId:r.id},orderBy:{createdAt:'desc'}});
    const latest=submissions[0];
    const items=latest?intakeChecklist(this.snapshot(latest)):[];
    const reviews=(latest?.reviews??[]) as IntakeReview[];
    let complete=false;try{assertReviewsComplete(items,reviews);complete=true;}catch{}
    return {requestId:r.id,revision:r.revision,status:r.status,currentSubmissionId:latest?.id??null,
      correctionRequest:r.correctionRequest??null,
      canAccept:r.status==='ASSIGNED'&&complete&&!issues.some(i=>i.status==='OPEN'),
      checklist:items.map(i=>({...i,review:reviews.find(x=>x.id===i.id) ? this.reviewView(reviews.find(x=>x.id===i.id)!,internal):null})),
      submissions:submissions.map(s=>({id:s.id,sequence:s.sequence,submittedAt:s.submittedAt,returnedAt:s.returnedAt,
        snapshot:this.snapshot(s),changes:s.changes,returnItems:s.returnItems,reviews:(s.reviews as IntakeReview[]).map(x=>this.reviewView(x,internal))})),
      issues:issues.map(i=>internal?i:{id:i.id,status:i.status,publicMessage:i.publicMessage})};
  }
  private reviewView(r:IntakeReview,internal:boolean) {
    return internal?r:{id:r.id,label:r.label,decision:r.decision,message:r.message,documentIds:r.documentIds,carriedFrom:r.carriedFrom};
  }
  async review(id:string,body:any,actor:Actor) {
    this.body(body,['expectedRevision','clientRequestId','submissionId','itemId','decision','message']);
    if(!['ACCEPTED','NEEDS_CORRECTION'].includes(body.decision) || typeof body.itemId!=='string' || typeof body.submissionId!=='string') throw new BadRequestException('Kết quả kiểm tra không hợp lệ.');
    const message=body.decision==='NEEDS_CORRECTION'?this.text(body.message,'lý do cần sửa'):body.message===undefined?'':this.text(body.message,'ghi nhận');
    return this.db.$transaction(async tx=>{
      const r=await this.lock(tx,id,actor);
      if(await this.operation(tx,r,body,actor.id,'REVIEW'))return tx.portalRequest.findUniqueOrThrow({where:{id},include:this.include});
      if(r.status!=='ASSIGNED')throw new ConflictException('Chỉ kiểm tra khi đề nghị đang chờ ngân hàng xử lý.');
      const s=await this.latest(tx,id);
      if(s.id!==body.submissionId)throw new ConflictException('Lần gửi đã thay đổi.');
      const item=intakeChecklist(this.snapshot(s)).find(i=>i.id===body.itemId);
      if(!item || !item.documentIds.length)throw new BadRequestException('Mục không thuộc checklist cần kiểm tra hoặc thiếu tài liệu.');
      const reviews=(s.reviews as IntakeReview[]).filter(x=>x.id!==item.id);
      reviews.push({...item,decision:body.decision,message,reviewerId:actor.id,reviewedAt:new Date().toISOString()});
      await tx.portalSubmission.update({where:{id:s.id},data:{reviews:json(reviews)}});
      return tx.portalRequest.update({where:{id},data:{revision:{increment:1}},include:this.include});
    });
  }
  async returnForCorrection(id:string,body:any,actor:Actor) {
    this.body(body,['expectedRevision','clientRequestId','submissionId']);
    return this.db.$transaction(async tx=>{
      const r=await this.lock(tx,id,actor);
      if(await this.operation(tx,r,body,actor.id,'RETURN'))return r;
      if(r.status!=='ASSIGNED')throw new ConflictException('Đề nghị không ở trạng thái có thể trả sửa.');
      const s=await this.latest(tx,id);
      if(s.id!==body.submissionId)throw new ConflictException('Lần gửi đã thay đổi.');
      const items=(s.reviews as IntakeReview[]).filter(x=>x.decision==='NEEDS_CORRECTION').map(x=>({itemId:x.id,label:x.label,message:x.message,documentIds:x.documentIds}));
      if(!items.length)throw new BadRequestException('Cần ghi rõ ít nhất một mục yêu cầu sửa trước khi trả.');
      await tx.portalSubmission.update({where:{id:s.id},data:{returnedAt:new Date(),returnItems:json(items)}});
      return tx.portalRequest.update({where:{id},data:{status:'RETURNED',revision:{increment:1},correctionRequest:Prisma.DbNull},include:this.include});
    });
  }
  async requestCorrection(id:string,body:any,accountId:string) {
    this.body(body,['expectedRevision','clientRequestId','message']);
    const message=this.text(body.message,'nội dung cần chỉnh sửa');
    return this.db.$transaction(async tx=>{
      const r=await this.lock(tx,id,accountId);
      if(await this.operation(tx,r,body,accountId,'REQUEST_CORRECTION'))return r;
      if(!['SUBMITTED','ASSIGNED'].includes(r.status))throw new ConflictException('Chỉ đề nghị sửa trước khi được tiếp nhận.');
      await this.latest(tx,id);
      if(!r.assignedTo){const managers=await tx.user.findMany({where:{isActive:true,roles:{some:{role:{code:'QUAN_LY'}}}},select:{id:true}});
        if(managers.length)await tx.internalNotification.createMany({data:managers.map(u=>({userId:u.id,requestId:id,title:'Doanh nghiệp đề nghị chỉnh sửa',message:`Cần phân công xử lý đề nghị ${r.reference}.`}))});}
      return tx.portalRequest.update({where:{id},data:{revision:{increment:1},correctionRequest:json({message,requestedAt:new Date().toISOString()})},include:this.include});
    });
  }
  async issue(id:string,body:any,actor:Actor) {
    this.body(body,['expectedRevision','clientRequestId','issueId','description','proposal','publicMessage','resolution']);
    const resolving=body.issueId!==undefined;
    const description=resolving?'':this.text(body.description,'vấn đề'),proposal=resolving?'':this.text(body.proposal,'phương án/đầu mối xử lý');
    const publicMessage=resolving?'':this.text(body.publicMessage,'thông báo cho doanh nghiệp');
    const resolution=resolving?this.text(body.resolution,'kết quả xử lý'):null;
    return this.db.$transaction(async tx=>{
      const r=await this.lock(tx,id,actor,true);
      if(await this.operation(tx,r,body,actor.id,resolving?'RESOLVE_ISSUE':'CREATE_ISSUE'))return r;
      if(r.status==='ACCEPTED')throw new ConflictException('Đề nghị đã tiếp nhận; xử lý tại hồ sơ vay.');
      await this.latest(tx,id);
      if(resolving){const issue=await tx.portalIntakeIssue.findFirst({where:{id:body.issueId,requestId:id,status:'OPEN'}});
        if(!issue)throw new NotFoundException('Không có vướng mắc đang mở.');
        await tx.portalIntakeIssue.update({where:{id:issue.id},data:{status:'RESOLVED',resolution,updatedBy:actor.id}});
      }else await tx.portalIntakeIssue.create({data:{id:randomUUID(),requestId:id,description,proposal,publicMessage,createdBy:actor.id,updatedBy:actor.id}});
      return tx.portalRequest.update({where:{id},data:{revision:{increment:1}},include:this.include});
    });
  }
  async assertAccept(tx:Prisma.TransactionClient,r:any,expectedRevision:unknown,submissionId:unknown) {
    const s=await this.latest(tx,r.id);
    if(r.revision!==expectedRevision || s.id!==submissionId)throw new ConflictException('Đề nghị hoặc lần gửi đã đổi; tải lại trước khi tiếp nhận.');
    const snapshot=this.snapshot(s);
    const a=evaluateIntakeReadiness(getApprovedPolicy(snapshot.policy.version),snapshot.data,snapshot.documents,{phase:'INTAKE',submittedAt:s.submittedAt});
    if(!a.dataReady)throw new ConflictException('Bản gửi chưa đủ điều kiện tiếp nhận.');
    assertReviewsComplete(intakeChecklist(snapshot),s.reviews as IntakeReview[]);
    if(await tx.portalIntakeIssue.count({where:{requestId:r.id,status:'OPEN'}}))throw new ConflictException('Còn vướng mắc chưa xử lý, chưa thể tiếp nhận.');
    return snapshot;
  }
}
