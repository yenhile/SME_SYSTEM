import {Injectable,BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {PrismaService} from '../../prisma.service';
import {PredictionService} from '../prediction/prediction.service';
import {lockOfficer,LoanActor} from '../workflow/loan-policy';
import {assignmentPayloadHash,assignmentReason,assertAssignmentVersion,validateAssignmentOperation} from './assignment-safety';
import {AssignmentSubject,COORDINATION_REASONS,lockCoordinationCompany,obsoleteCoordination} from './assignment-coordination';
import {transferLoan,transferPortal,assignmentPrediction} from './assignment.transactions';
import {allowedCoordinationReasons} from './coordination-scope';

const person={id:true,fullName:true,username:true};
const people={requester:{select:person},resolver:{select:person},targetOfficer:{select:person}};
const states=['PENDING','APPROVED','REJECTED','CANCELLED','OBSOLETE'];
/** Vai trò xem toàn bộ đề nghị của chi nhánh; quyền quyết định thuộc riêng Quản lý, Admin chỉ xem. */
const BRANCH_WIDE=['QUAN_LY','ADMIN'];
type Kind='approve'|'reject'|'cancel';
@Injectable()
export class AssignmentChangeRequestsService{
  constructor(private prisma:PrismaService,private prediction:PredictionService){}
  /** Lý do dùng được cho hồ sơ vay do chính CBTD phụ trách; không có hồ sơ hoặc không phải người phụ trách thì trả đủ lý do. */
  async capabilities(query:{subjectType?:string;subjectId?:string}={},actor?:LoanActor){
    const base={enabled:true,conflictOfInterestEnabled:true,reasonCodes:[...COORDINATION_REASONS] as string[],restriction:null as string|null};
    if(query.subjectType!=='LOAN'||typeof query.subjectId!=='string'||!query.subjectId||actor?.activeRole!=='CBTD')return base;
    const owner=await this.prisma.loanApplication.findUnique({where:{id:query.subjectId},select:{assignedTo:true}});
    if(owner?.assignedTo!==actor.id)return base;
    return {...base,...await allowedCoordinationReasons(this.prisma,query.subjectId)};
  }
  private role(actor:LoanActor){if(!['CBTD','QUAN_LY','ADMIN'].includes(actor.activeRole))throw new ForbiddenException('Vai trò không được dùng đề nghị điều phối.');}
  private subject(r:any):AssignmentSubject{return r.portalRequestId?{portalRequestId:r.portalRequestId}:{applicationId:r.applicationId};}
  private async context(db:any,subject:AssignmentSubject,lock=false){
    if(subject.portalRequestId){
      if(lock)await db.$queryRaw`SELECT id FROM portal_requests WHERE id=${subject.portalRequestId} FOR UPDATE`;
      const r=await db.portalRequest.findUnique({where:{id:subject.portalRequestId},select:{id:true,reference:true,assignedTo:true,assignmentVersion:true,revision:true,status:true,data:true,loan:{select:{assignedTo:true}}}});
      return r?{subjectType:'PORTAL',subjectId:r.id,code:r.reference,owner:r.assignedTo,accessOwner:r.status==='ACCEPTED'?r.loan?.assignedTo:r.assignedTo,version:r.assignmentVersion,revision:r.revision,taxCode:r.data?.taxCode,eligible:['ASSIGNED','RETURNED'].includes(r.status),closed:r.status==='ACCEPTED'?'PORTAL_ACCEPTED':null}:null;
    }
    if(lock)await db.$queryRaw`SELECT id FROM loan_applications WHERE id=${subject.applicationId} FOR UPDATE`;
    const r=await db.loanApplication.findUnique({where:{id:subject.applicationId},select:{id:true,applicationCode:true,assignedTo:true,assignmentVersion:true,currentStage:true,completedAt:true,company:{select:{taxCode:true}}}});
    return r?{subjectType:'LOAN',subjectId:r.id,code:r.applicationCode,owner:r.assignedTo,accessOwner:r.assignedTo,version:r.assignmentVersion,taxCode:r.company.taxCode,eligible:!r.completedAt&&r.currentStage!=='HOAN_TAT',closed:r.completedAt||r.currentStage==='HOAN_TAT'?'LOAN_COMPLETED':null}:null;
  }
  private authorize(r:any,actor:LoanActor){this.role(actor);if(!r||(!BRANCH_WIDE.includes(actor.activeRole)&&r.requestedById!==actor.id))throw new NotFoundException('Không tìm thấy biên nhận điều phối trong phạm vi của bạn.');}
  private async view(db:any,r:any,actor:LoanActor,replayed=false){
    const c=await this.context(db,this.subject(r));
    return{id:r.id,subjectType:c?.subjectType??(r.portalRequestId?'PORTAL':'LOAN'),subjectId:c?.subjectId??r.portalRequestId??r.applicationId,subjectCode:c?.code??'Hồ sơ không còn khả dụng',
      requestedById:r.requestedById,requester:r.requester??null,resolver:r.resolver??null,targetOfficer:r.targetOfficer??null,
      reasonCode:r.reasonCode,reason:r.reason,status:r.status,requestVersion:r.requestVersion,createdAt:r.createdAt,resolvedAt:r.resolvedAt,
      decisionReason:r.decisionReason,resolutionCode:r.resolutionCode,managerRecipientCount:r.managerRecipientCount,
      currentOwnerId:c?.owner??null,currentAssignmentVersion:c?.version??null,currentCaseLinkAllowed:!!c&&(BRANCH_WIDE.includes(actor.activeRole)||(actor.activeRole==='CBTD'&&c.accessOwner===actor.id)),
      canResolve:r.status==='PENDING'&&actor.activeRole==='QUAN_LY'&&actor.id!==r.requestedById,
      canCancel:r.status==='PENDING'&&actor.activeRole==='CBTD'&&actor.id===r.requestedById&&r.reasonCode!=='CONFLICT_OF_INTEREST',replayed};
  }
  async detail(id:string,actor:LoanActor){const r=await this.prisma.assignmentChangeRequest.findUnique({where:{id},include:people});this.authorize(r,actor);return this.view(this.prisma,r,actor);}
  async list(query:any,actor:LoanActor){
    this.role(actor);
    if(query.status&&!states.includes(query.status))throw new BadRequestException('Trạng thái điều phối không hợp lệ.');
    if(query.subjectType&&!['LOAN','PORTAL'].includes(query.subjectType))throw new BadRequestException('Loại đối tượng không hợp lệ.');
    if(query.subjectId&&!query.subjectType)throw new BadRequestException('Cần loại đối tượng.');
    const where:any={...(actor.activeRole==='CBTD'?{requestedById:actor.id}:{}),...(query.status?{status:query.status}:{})};
    if(query.subjectType)where[query.subjectType==='LOAN'?'applicationId':'portalRequestId']=query.subjectId||{not:null};
    const rows=await this.prisma.assignmentChangeRequest.findMany({where,include:people,orderBy:[{createdAt:'asc'},{id:'asc'}]});
    const ordered=rows.sort((a,b)=>Number(b.reasonCode==='CONFLICT_OF_INTEREST'&&b.status==='PENDING')-Number(a.reasonCode==='CONFLICT_OF_INTEREST'&&a.status==='PENDING'));
    return Promise.all(ordered.map(r=>this.view(this.prisma,r,actor)));
  }
  async create(body:any,actor:LoanActor){
    this.role(actor);if(actor.activeRole!=='CBTD')throw new ForbiddenException('Chỉ CBTD đang phụ trách được gửi đề nghị.');
    if(!body||Object.keys(body).some(k=>!['subjectType','subjectId','expectedAssignmentVersion','clientRequestId','reasonCode','reason'].includes(k))||!['LOAN','PORTAL'].includes(body.subjectType)||typeof body.subjectId!=='string'||!body.subjectId||!COORDINATION_REASONS.includes(body.reasonCode))throw new BadRequestException('Thông tin đề nghị điều phối không hợp lệ.');
    validateAssignmentOperation(body);const reason=assignmentReason(body.reason)!;
    const payloadHash=assignmentPayloadHash([body.subjectType,body.subjectId,body.expectedAssignmentVersion,body.reasonCode,reason]);
    const subject=body.subjectType==='LOAN'?{applicationId:body.subjectId}:{portalRequestId:body.subjectId};
    return this.prisma.$transaction(async tx=>{
      const c=await this.context(tx,subject,true);if(!c)throw new NotFoundException('Không tìm thấy hồ sơ.');
      const prior=await tx.assignmentChangeRequest.findUnique({where:{requestedById_createClientRequestId:{requestedById:actor.id,createClientRequestId:body.clientRequestId}},include:people});
      if(prior){if(prior.createPayloadHash!==payloadHash)throw new ConflictException('Mã thao tác đã dùng cho đề nghị khác.');return this.view(tx,prior,actor,true);}
      if(c.owner!==actor.id)throw new ForbiddenException('Bạn chỉ được đề nghị điều phối hồ sơ đang phụ trách.');
      if(!c.eligible)throw new ConflictException('Đối tượng đã chuyển giai đoạn hoặc kết thúc; hãy tải lại.');
      if(subject.applicationId&&body.reasonCode!=='CONFLICT_OF_INTEREST'){
        const scope=await allowedCoordinationReasons(tx,subject.applicationId);
        if(!scope.reasonCodes.includes(body.reasonCode))throw new ConflictException(scope.restriction);
      }
      assertAssignmentVersion(c.version,body.expectedAssignmentVersion);
      if(await tx.assignmentChangeRequest.findFirst({where:{...subject,status:'PENDING'}}))throw new ConflictException('Đã có đề nghị điều phối đang chờ giải quyết.');
      if(body.reasonCode==='CONFLICT_OF_INTEREST')await lockCoordinationCompany(tx,actor.id,c.taxCode);
      const managers=await tx.user.findMany({where:{id:{not:actor.id},isActive:true,roles:{some:{role:{code:'QUAN_LY'}}}},select:{id:true}});
      const r=await tx.assignmentChangeRequest.create({data:{...subject,requestedById:actor.id,assignmentVersionAtRequest:c.version,reasonCode:body.reasonCode,reason,createClientRequestId:body.clientRequestId,createPayloadHash:payloadHash,managerRecipientCount:managers.length},include:people});
      if(managers.length)await tx.internalNotification.createMany({data:managers.map(m=>({userId:m.id,assignmentChangeRequestId:r.id,title:body.reasonCode==='CONFLICT_OF_INTEREST'?'Ưu tiên: đề nghị xung đột lợi ích':'Đề nghị điều phối chờ xử lý',message:`Có đề nghị điều phối cho ${c.code}. Vui lòng xem xét.`}))});
      return this.view(tx,r,actor);
    }).catch((error:any)=>{
      if(error.code==='P2002')throw new ConflictException('Mã thao tác đã được dùng hoặc đã có đề nghị đang chờ. Vui lòng tải lại để đối chiếu.');
      throw error;
    });
  }
  async resolve(id:string,kind:Kind,body:any,actor:LoanActor){
    this.role(actor);
    if(kind!=='cancel'&&actor.activeRole!=='QUAN_LY')throw new ForbiddenException('Chỉ QLCN được quyết định điều phối.');
    if(kind==='cancel'&&actor.activeRole!=='CBTD')throw new ForbiddenException('Chỉ CBTD gửi đề nghị được rút.');
    if(!body||Object.keys(body).some(k=>!['expectedRequestVersion','expectedAssignmentVersion','clientRequestId','decisionReason','newOfficerId','confirmCanContinue','resolutionCode'].includes(k))||!Number.isSafeInteger(body.expectedRequestVersion)||body.expectedRequestVersion<0)throw new BadRequestException('Cần phiên bản đề nghị hợp lệ.');
    validateAssignmentOperation(body);
    const reason=assignmentReason(body.decisionReason,kind!=='cancel')??'CBTD rút đề nghị điều phối.';
    if(kind==='approve'&&(typeof body.newOfficerId!=='string'||!body.newOfficerId))throw new BadRequestException('Cần chọn CBTD nhận bàn giao.');
    const payloadHash=assignmentPayloadHash([kind,body.expectedRequestVersion,body.expectedAssignmentVersion,reason,body.newOfficerId??null,body.confirmCanContinue??null,body.resolutionCode??null]);
    let loanToPredict:string|undefined,replayed=false;
    const receipt=await this.prisma.$transaction(async tx=>{
      const initial=await tx.assignmentChangeRequest.findUnique({where:{id}});this.authorize(initial,actor);
      const subject=this.subject(initial),c=await this.context(tx,subject,true);
      await tx.$queryRaw`SELECT id FROM assignment_change_requests WHERE id=${id} FOR UPDATE`;
      const r=await tx.assignmentChangeRequest.findUniqueOrThrow({where:{id},include:people});
      if(kind==='cancel'&&r.requestedById!==actor.id)throw new ForbiddenException('Bạn không phải người gửi.');
      if(kind!=='cancel'&&r.requestedById===actor.id)throw new ForbiddenException('Không được tự xử lý đề nghị của mình bằng cách đổi vai trò.');
      if(r.resolutionClientRequestId===body.clientRequestId){
        if(r.resolvedById!==actor.id||r.resolutionPayloadHash!==payloadHash)throw new ConflictException('Mã quyết định đã được dùng với nội dung khác.');
        replayed=true;return this.view(tx,r,actor,true);
      }
      if(r.status!=='PENDING')throw new ConflictException('Đề nghị đã được giải quyết hoặc hết hiệu lực.');
      if(!c||!c.eligible||c.owner!==r.requestedById||c.version!==r.assignmentVersionAtRequest){
        await obsoleteCoordination(tx,subject,c?.closed??'OWNER_CHANGED');
        const expired=await tx.assignmentChangeRequest.update({where:{id},data:{resolutionClientRequestId:body.clientRequestId,resolutionPayloadHash:payloadHash,resolvedById:actor.id},include:people});
        return this.view(tx,expired,actor);
      }
      if(r.requestVersion!==body.expectedRequestVersion)throw new ConflictException('Đề nghị điều phối đã thay đổi; hãy tải lại.');
      assertAssignmentVersion(c.version,body.expectedAssignmentVersion);
      if(kind==='cancel'&&r.reasonCode==='CONFLICT_OF_INTEREST')throw new ForbiddenException('Không được tự rút đề nghị xung đột lợi ích.');
      if(kind==='reject'){
        if(body.confirmCanContinue!==true)throw new BadRequestException('Cần xác nhận CBTD còn có thể tiếp tục xử lý thực tế.');
        if(r.reasonCode==='CONFLICT_OF_INTEREST'&&body.resolutionCode!=='NO_CONFLICT_CONFIRMED')throw new BadRequestException('Cần kết luận có căn cứ rằng không có xung đột lợi ích.');
        await lockOfficer(tx,r.requestedById);
        const sender=await tx.user.findFirst({where:{id:r.requestedById,isActive:true,roles:{some:{role:{code:'CBTD'}}}},select:{id:true}});
        if(!sender)throw new BadRequestException('CBTD không còn hợp lệ; hãy chọn hướng điều chuyển.');
      }
      if(kind==='approve'){
        if(body.newOfficerId===c.owner||body.newOfficerId===actor.id)throw new BadRequestException('Cần chọn CBTD nhận khác người đang phụ trách và người quyết định.');
        if(subject.applicationId){await transferLoan(tx,subject.applicationId,{newOfficerId:body.newOfficerId,reason,expectedAssignmentVersion:c.version,clientRequestId:body.clientRequestId},actor.id,id);loanToPredict=subject.applicationId;}
        else await transferPortal(tx,subject.portalRequestId!,{officerId:body.newOfficerId,expectedAssignedTo:c.owner,expectedRevision:c.revision,expectedAssignmentVersion:c.version,clientRequestId:body.clientRequestId,note:reason},actor.id,{},id);
      }
      const resolved=await tx.assignmentChangeRequest.update({where:{id},data:{status:kind==='approve'?'APPROVED':kind==='reject'?'REJECTED':'CANCELLED',requestVersion:{increment:1},resolvedAt:new Date(),resolvedById:actor.id,decisionReason:reason,resolutionCode:kind==='reject'&&r.reasonCode==='CONFLICT_OF_INTEREST'?'NO_CONFLICT_CONFIRMED':kind.toUpperCase(),targetOfficerId:kind==='approve'?body.newOfficerId:null,resolutionClientRequestId:body.clientRequestId,resolutionPayloadHash:payloadHash},include:people});
      const recipients=kind==='cancel'?await tx.user.findMany({where:{id:{not:actor.id},isActive:true,roles:{some:{role:{code:'QUAN_LY'}}}},select:{id:true}}):[{id:r.requestedById}];
      if(recipients.length)await tx.internalNotification.createMany({data:recipients.map(u=>({userId:u.id,assignmentChangeRequestId:id,title:'Đề nghị điều phối đã có kết quả',message:`Đề nghị điều phối ${c.code} đã được cập nhật. Mở biên nhận để xem kết quả.`}))});
      return this.view(tx,resolved,actor);
    });
    return{...receipt,...(loanToPredict?{prediction:await assignmentPrediction(this.prediction,loanToPredict,false)}:replayed?{prediction:{status:'NOT_REPEATED',message:'Không gọi lại dự báo cho thao tác đã ghi nhận.'}}:{})};
  }
}
