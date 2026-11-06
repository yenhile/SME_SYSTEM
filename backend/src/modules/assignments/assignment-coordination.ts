import { ForbiddenException } from '@nestjs/common';

export const COORDINATION_REASONS = ['WORKLOAD','UNAVAILABLE','ASSIGNMENT_MISMATCH','CONFLICT_OF_INTEREST','OTHER'] as const;
export type AssignmentSubject = {applicationId?:string;portalRequestId?:string};

/** Caller holds the parent row lock; actor identity is checked independently of activeRole. */
export async function assertNoCoordinationConflict(tx:any,subject:AssignmentSubject,actorId:string,decision=false) {
  const pending=await tx.assignmentChangeRequest.findFirst({where:{...subject,status:'PENDING',reasonCode:'CONFLICT_OF_INTEREST',...(decision?{}:{requestedById:actorId})},select:{id:true}});
  if(pending)throw new ForbiddenException(decision?'Cần giải quyết đề nghị xung đột lợi ích trước khi chốt quyết định tín dụng.':'Bạn đang có đề nghị xung đột lợi ích chưa giải quyết; không được ghi nghiệp vụ trên hồ sơ này.');
}

/** Company writes and COI creation share this lock; Company paths never lock case rows afterwards. */
export async function lockCoordinationCompany(tx:any,actorId:string,taxCode:string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`sme-coordination-company:${actorId}:${taxCode}`}))::text`;
}
export async function assertNoCompanyConflict(tx:any,actorId:string,taxCode:string) {
  await lockCoordinationCompany(tx,actorId,taxCode);
  const pending=await tx.assignmentChangeRequest.findFirst({where:{requestedById:actorId,status:'PENDING',reasonCode:'CONFLICT_OF_INTEREST',OR:[{application:{company:{taxCode}}},{portalRequest:{data:{path:['taxCode'],equals:taxCode}}}]},select:{id:true}});
  if(pending)throw new ForbiddenException('Không được sửa Company hoặc tạo hồ sơ liên quan khi đề nghị xung đột lợi ích của bạn đang chờ xử lý.');
}

/** Same transaction as owner/context change. Never throw after writing OBSOLETE. */
export async function obsoleteCoordination(tx:any,subject:AssignmentSubject,resolutionCode:string,excludeId?:string) {
  const pending=await tx.assignmentChangeRequest.findMany({where:{...subject,status:'PENDING',...(excludeId?{id:{not:excludeId}}:{})}});
  for(const request of pending){
    await tx.assignmentChangeRequest.update({where:{id:request.id},data:{status:'OBSOLETE',requestVersion:{increment:1},resolvedAt:new Date(),resolutionCode,decisionReason:'Bối cảnh hồ sơ đã thay đổi; đề nghị điều phối này hết hiệu lực.'}});
    await tx.internalNotification.createMany({data:[{userId:request.requestedById,assignmentChangeRequestId:request.id,title:'Đề nghị điều phối hết hiệu lực',message:'Bối cảnh phân công hoặc hồ sơ đã thay đổi. Mở biên nhận để xem kết quả.'}]});
  }
}
