import { Injectable, Logger, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { PredictionService } from '../prediction/prediction.service';
import { assertOfficialAmount, BRANCH_POLICY, LoanActor } from '../workflow/loan-policy';
import { assertIndependent, digest, isEvidenceChanged, proposedRateOf, reportEvidence, validateReport } from './appraisal.logic';
import { assertRateInBand, findActiveBand } from '../rate-bands/rate-band.logic';
import {assertNoCoordinationConflict} from '../assignments/assignment-coordination';
@Injectable()
export class AppraisalService {
  private readonly logger = new Logger(AppraisalService.name);
  constructor(private prisma:PrismaService,private workflow:WorkflowService,private prediction:PredictionService) {}
  async view(id:string, actor?: { id: string; activeRole?: string }) {
    const report = await this.prisma.appraisalReport.findUnique({where:{applicationId:id},include:{versions:{orderBy:{sequence:'desc'}},events:{orderBy:{createdAt:'asc'}}}});
    if (!report) return null;
    if (!actor?.id) return report;

    const loan = await this.prisma.loanApplication.findUnique({ where: { id } });

    let isIndependent = true;
    let clarifyBlockReason: string | null = null;
    if (loan) {
      if (loan.assignedTo === actor.id) {
        isIndependent = false;
        clarifyBlockReason = 'Bạn đang phụ trách hồ sơ này nên không được yêu cầu làm rõ (Maker-Checker).';
      } else if (loan.intakeOfficerId && loan.intakeOfficerId === actor.id) {
        isIndependent = false;
        clarifyBlockReason = 'Bạn là người tiếp nhận ban đầu của hồ sơ này nên không được yêu cầu làm rõ (Maker-Checker).';
      } else {
        const authored = await this.prisma.appraisalReportEvent.findFirst({
          where: {
            reportId: report.id,
            actorId: actor.id,
            kind: { in: ['DRAFT_SAVED', 'SUBMITTED'] },
          },
        });
        if (authored) {
          isIndependent = false;
          clarifyBlockReason = 'Bạn đã tham gia lập hoặc sửa tờ trình nên không được yêu cầu làm rõ (Maker-Checker).';
        }
      }
    }

    const latest = report.versions[0];
    const awaitingDecision = report.status === 'SUBMITTED' && loan?.currentStage === 'THAM_DINH' && !loan.completedAt && Boolean(latest);
    const evidenceChanged = awaitingDecision ? await isEvidenceChanged(this.prisma, loan, latest.evidenceHash) : false;
    const authors = report.versions.length
      ? await this.prisma.user.findMany({ where: { id: { in: [...new Set(report.versions.map(version => version.submittedBy))] } }, select: { id: true, fullName: true, username: true } })
      : [];
    const authorNames = new Map(authors.map(author => [author.id, author.fullName || author.username]));

    return {
      ...report,
      versions: report.versions.map(version => ({ ...version, submittedByName: authorNames.get(version.submittedBy) ?? null })),
      evidenceChanged,
      makerChecker: {
        isIndependent,
        canClarify: isIndependent,
        clarifyBlockReason,
      },
    };
  }
  private body(body:any) {
    if (!body || Object.keys(body).some(k=>!['expectedRevision','clientRequestId','content','message'].includes(k)) || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision<0
      || typeof body.clientRequestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.clientRequestId)) throw new BadRequestException('Cần phiên bản và mã thao tác UUID hợp lệ.');
  }
  async mutate(id:string,kind:'DRAFT_SAVED'|'SUBMITTED'|'CLARIFICATION_REQUESTED',body:any,user:LoanActor) {
    this.body(body);
    const payloadHash=digest({kind,body}); let firstTransition=false,replayed=false;
    await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM loan_applications WHERE id=${id} FOR UPDATE`;
      const loan=await tx.loanApplication.findUnique({where:{id}});
      if (!loan) throw new NotFoundException('Không tìm thấy hồ sơ.');
      if (loan.businessPolicyVersion !== BRANCH_POLICY) throw new BadRequestException('Hồ sơ này giữ quy trình trước khi áp dụng tờ trình mới.');
      if (loan.completedAt || loan.currentStage==='HOAN_TAT') throw new ForbiddenException('Hồ sơ đã kết thúc.');
      await assertNoCoordinationConflict(tx,{applicationId:id},user.id);
      const author=kind!=='CLARIFICATION_REQUESTED';
      if (author) {
        if (user.activeRole!=='CBTD' || loan.assignedTo!==user.id) throw new ForbiddenException('Chỉ CBTD đang được phân công được lập tờ trình.');
      } else {
        if(user.activeRole!=='THAM_QUYEN' || loan.currentStage!=='THAM_DINH') throw new ForbiddenException('Chỉ Thẩm quyền tại Thẩm định được yêu cầu làm rõ.');
        await assertIndependent(tx,loan,user);
      }
      let report=await tx.appraisalReport.findUnique({where:{applicationId:id}});
      if (report) {
        const prior=await tx.appraisalReportEvent.findUnique({where:{reportId_clientRequestId:{reportId:report.id,clientRequestId:body.clientRequestId}}});
        if(prior) {
          if(prior.actorId!==user.id || prior.payloadHash!==payloadHash) throw new ConflictException('Mã thao tác đã được dùng với nội dung khác.');
          replayed=true;return;
        }
      }
      if ((report?.revision ?? 0)!==body.expectedRevision) throw new ConflictException('Tờ trình đã thay đổi. Vui lòng tải lại.');
      if(!report) report=await tx.appraisalReport.create({data:{applicationId:id,draft:{}}});
      if(kind==='CLARIFICATION_REQUESTED') {
        if(report.status!=='SUBMITTED' || typeof body.message!=='string' || !body.message.trim() || body.message.length>4000) throw new BadRequestException('Cần nội dung làm rõ cụ thể cho bản đã trình.');
        await tx.appraisalReport.update({where:{id:report.id},data:{status:'CLARIFICATION_REQUIRED',revision:{increment:1},clarification:{message:body.message.trim(),actorId:user.id,at:new Date().toISOString()}}});
        await tx.internalNotification.create({data:{userId:loan.assignedTo!,applicationId:id,title:'Tờ trình cần làm rõ',message:`Hồ sơ ${loan.applicationCode}: ${body.message.trim()}`}});
      } else {
        if(!['DRAFT','CLARIFICATION_REQUIRED'].includes(report.status)) throw new ConflictException('Bản đã trình được khóa. Chỉ sửa khi có yêu cầu làm rõ.');
        if(loan.currentStage!=='TIEP_NHAN' && report.status!=='CLARIFICATION_REQUIRED') throw new ForbiddenException('Chưa mở quyền sửa tờ trình tại công đoạn này.');
        const content=validateReport(kind==='DRAFT_SAVED'?body.content:report.draft,kind==='SUBMITTED');
        if(kind==='SUBMITTED') {
          if(loan.currentStatus==='SUPPLEMENT_REQUIRED' || await tx.supplementRequest.count({where:{applicationId:id,status:'PENDING'}})) throw new ConflictException('Cần hoàn tất bổ sung trước khi trình.');
          if(loan.currentStage==='TIEP_NHAN' && (!loan.isDocumentComplete || loan.currentStatus!=='CHECKED')) throw new BadRequestException('Cần xác nhận đủ chứng từ trước khi trình.');
          if(!loan.officialAmount) throw new BadRequestException('Cần xác nhận hạn mức chính thức trước khi trình.');
          assertOfficialAmount(loan.officialAmount, loan.proposedAmount);
          assertRateInBand(proposedRateOf(content)!, await findActiveBand(tx, loan.loanType, loan.loanTermMonths, new Date()), loan.loanType, 'Lãi suất đề xuất');
          const evidence=await reportEvidence(tx,loan);
          const sequence=await tx.appraisalReportVersion.count({where:{reportId:report.id}})+1;
          await tx.appraisalReportVersion.create({data:{reportId:report.id,sequence,content,evidence,evidenceHash:digest(evidence),submittedBy:user.id}});
          await tx.appraisalReport.update({where:{id:report.id},data:{status:'SUBMITTED',draft:content,revision:{increment:1}}});
          if(loan.currentStage==='TIEP_NHAN') {
            await this.workflow.transitionStage(id,{targetStage:'THAM_DINH',targetStatus:'PENDING_APPRAISAL'},user,new Date(),tx);
            firstTransition=true;
          }
          const reviewers=await tx.user.findMany({where:{isActive:true,roles:{some:{role:{code:'THAM_QUYEN'}}}},select:{id:true}});
          for(const reviewer of reviewers) if(reviewer.id!==user.id) await tx.internalNotification.create({data:{userId:reviewer.id,applicationId:id,title:'Tờ trình chờ xem xét',message:`Hồ sơ ${loan.applicationCode} đã trình bản ${sequence}.`}});
        } else await tx.appraisalReport.update({where:{id:report.id},data:{draft:content,revision:{increment:1}}});
      }
      await tx.appraisalReportEvent.create({data:{reportId:report.id,actorId:user.id,kind,clientRequestId:body.clientRequestId,payloadHash,payload:kind==='CLARIFICATION_REQUESTED'?{message:body.message.trim()}:{}}});
    },{timeout:30000});
    // Chấm lại khi trình (lần đầu hoặc bản mới sau làm rõ) và khi Thẩm quyền yêu cầu làm rõ; thao tác lặp (replay) không sinh dự báo trùng, lỗi ML chỉ ghi log.
    if(!replayed && (kind==='SUBMITTED' || kind==='CLARIFICATION_REQUESTED')) await this.prediction.predictForApplication(id).catch((err:any)=>this.logger.warn(`Không tạo được dự báo sau thao tác tờ trình hồ sơ ${id}: ${err?.message??err}`));
    return this.view(id);
  }
}
