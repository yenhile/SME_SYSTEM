import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { uploadRoot } from '../../common/storage';
import { companyForLoan } from '../companies/company-snapshot';
export const REPORT_FIELDS = ['legalAssessment','businessAssessment','financialAssessment','repaymentSource','collateralAssessment','risks','recommendation','proposedConditions'] as const;
export function validateReport(value: unknown, complete = false): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !REPORT_FIELDS.includes(k as any))) throw new BadRequestException('Nội dung tờ trình không hợp lệ.');
  const result: Record<string,string> = {};
  for (const field of REPORT_FIELDS) {
    const v = (value as any)[field];
    if (v !== undefined && (typeof v !== 'string' || v.length > 10000)) throw new BadRequestException(`Nội dung không hợp lệ: ${field}.`);
    if (complete && field !== 'proposedConditions' && !v?.trim()) throw new BadRequestException('Cần hoàn tất các phần phân tích và kết luận trước khi trình.');
    result[field] = v?.trim() ?? '';
  }
  return result;
}
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function reportEvidence(tx: any, loan: any) {
  await tx.$queryRaw`SELECT id FROM companies WHERE id=${loan.companyId} FOR SHARE`;
  const company = companyForLoan(loan,await tx.company.findUnique({where:{id:loan.companyId}}));
  const docs = await tx.document.findMany({where:{applicationId:loan.id},orderBy:{id:'asc'}});
  const documents = [];
  for (const d of docs) {
    if (basename(d.filePath) !== d.filePath) throw new ConflictException('Tài liệu chưa có tệp thực để làm căn cứ tờ trình.');
    let bytes: Buffer;
    try { bytes = await readFile(join(uploadRoot(),d.filePath)); }
    catch { throw new ConflictException('Không đọc được tài liệu làm căn cứ tờ trình.'); }
    if (bytes.length !== d.fileSize) throw new ConflictException('Tài liệu làm căn cứ đã thay đổi.');
    documents.push({id:d.id,documentType:d.documentType,fileName:d.fileName,fileSize:d.fileSize,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  const supplements = await tx.supplementRequest.findMany({where:{applicationId:loan.id},orderBy:{id:'asc'}});
  for(const request of supplements) for(const file of request.portalSupplement?.files ?? []) {
    if(!file.submittedAt) continue;
    if(basename(file.filePath)!==file.filePath) throw new ConflictException('Đường dẫn căn cứ bổ sung không hợp lệ.');
    let bytes:Buffer;
    try {bytes=await readFile(join(uploadRoot(),'supplements',file.filePath));}
    catch {throw new ConflictException('Không đọc được căn cứ bổ sung.');}
    if(bytes.length!==file.fileSize || createHash('sha256').update(bytes).digest('hex')!==file.sha256) throw new ConflictException('Căn cứ bổ sung đã thay đổi.');
  }
  return JSON.parse(JSON.stringify({company,proposedAmount:String(loan.proposedAmount),officialAmount:String(loan.officialAmount),loanPurpose:loan.loanPurpose,
    loanType:loan.loanType,loanTermMonths:loan.loanTermMonths,documents,
    supplements:supplements.map((s:any)=>({id:s.id,status:s.status,portalSupplement:s.portalSupplement,requestContent:s.requestContent,resolvedAt:s.resolvedAt}))}));
}
/** Căn cứ không còn đọc được cũng tính là đã đổi: bản đã trình không còn dùng để quyết định được. */
export async function isEvidenceChanged(db:any, loan:any, evidenceHash:string) {
  try {
    return digest(await reportEvidence(db,loan)) !== evidenceHash;
  } catch (error) {
    if (error instanceof ConflictException) return true;
    throw error;
  }
}
export async function assertIndependent(tx:any, loan:any, user:{id:string}) {
  if (loan.assignedTo === user.id || loan.intakeOfficerId === user.id) throw new ForbiddenException('Người tiếp nhận hoặc lập tờ trình không được tự quyết định hồ sơ.');
  const prior = await tx.appraisalReportEvent.findFirst({where:{report:{applicationId:loan.id},actorId:user.id,kind:{in:['DRAFT_SAVED','SUBMITTED']}}});
  if (prior) throw new ForbiddenException('Bạn đã tham gia lập hoặc sửa tờ trình nên không được tự quyết định hồ sơ.');
}
export async function assertReportDecision(tx:any, loan:any, user:{id:string}, versionId?:string) {
  await assertIndependent(tx,loan,user);
  const report = await tx.appraisalReport.findUnique({where:{applicationId:loan.id},include:{versions:{orderBy:{sequence:'desc'},take:1}}});
  const version=report?.versions[0];
  if (report?.status !== 'SUBMITTED' || !version || version.id !== versionId) throw new ConflictException('Cần đọc và quyết định trên đúng bản tờ trình đã trình, không còn yêu cầu làm rõ.');
  if (await tx.supplementRequest.count({where:{applicationId:loan.id,status:'PENDING'}})) throw new ConflictException('Còn yêu cầu bổ sung chưa hoàn tất.');
  if (digest(await reportEvidence(tx,loan)) !== version.evidenceHash) throw new ConflictException('Căn cứ đã thay đổi. Yêu cầu CBTD làm rõ và trình phiên bản mới.');
  return {report,version};
}
