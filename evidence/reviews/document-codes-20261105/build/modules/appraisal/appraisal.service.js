"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppraisalService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
const workflow_service_1 = require("../workflow/workflow.service");
const prediction_service_1 = require("../prediction/prediction.service");
const loan_policy_1 = require("../workflow/loan-policy");
const appraisal_logic_1 = require("./appraisal.logic");
const assignment_coordination_1 = require("../assignments/assignment-coordination");
let AppraisalService = class AppraisalService {
    prisma;
    workflow;
    prediction;
    constructor(prisma, workflow, prediction) {
        this.prisma = prisma;
        this.workflow = workflow;
        this.prediction = prediction;
    }
    async view(id, actor) {
        const report = await this.prisma.appraisalReport.findUnique({ where: { applicationId: id }, include: { versions: { orderBy: { sequence: 'desc' } }, events: { orderBy: { createdAt: 'asc' } } } });
        if (!report)
            return null;
        if (!actor?.id)
            return report;
        const loan = await this.prisma.loanApplication.findUnique({
            where: { id },
            select: { assignedTo: true, intakeOfficerId: true }
        });
        let isIndependent = true;
        let clarifyBlockReason = null;
        if (loan) {
            if (loan.assignedTo === actor.id) {
                isIndependent = false;
                clarifyBlockReason = 'Bạn đang phụ trách hồ sơ này nên không được yêu cầu làm rõ (Maker-Checker).';
            }
            else if (loan.intakeOfficerId && loan.intakeOfficerId === actor.id) {
                isIndependent = false;
                clarifyBlockReason = 'Bạn là người tiếp nhận ban đầu của hồ sơ này nên không được yêu cầu làm rõ (Maker-Checker).';
            }
            else {
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
        return {
            ...report,
            makerChecker: {
                isIndependent,
                canClarify: isIndependent,
                clarifyBlockReason,
            },
        };
    }
    body(body) {
        if (!body || Object.keys(body).some(k => !['expectedRevision', 'clientRequestId', 'content', 'message'].includes(k)) || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0
            || typeof body.clientRequestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.clientRequestId))
            throw new common_1.BadRequestException('Cần phiên bản và mã thao tác UUID hợp lệ.');
    }
    async mutate(id, kind, body, user) {
        this.body(body);
        const payloadHash = (0, appraisal_logic_1.digest)({ kind, body });
        let firstTransition = false;
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM loan_applications WHERE id=${id} FOR UPDATE`;
            const loan = await tx.loanApplication.findUnique({ where: { id } });
            if (!loan)
                throw new common_1.NotFoundException('Không tìm thấy hồ sơ.');
            if (loan.businessPolicyVersion !== loan_policy_1.BRANCH_POLICY)
                throw new common_1.BadRequestException('Hồ sơ này giữ quy trình trước khi áp dụng tờ trình mới.');
            if (loan.completedAt || loan.currentStage === 'HOAN_TAT')
                throw new common_1.ForbiddenException('Hồ sơ đã kết thúc.');
            await (0, assignment_coordination_1.assertNoCoordinationConflict)(tx, { applicationId: id }, user.id);
            const author = kind !== 'CLARIFICATION_REQUESTED';
            if (author) {
                if (user.activeRole !== 'CBTD' || loan.assignedTo !== user.id)
                    throw new common_1.ForbiddenException('Chỉ CBTD đang được phân công được lập tờ trình.');
            }
            else {
                if (user.activeRole !== 'THAM_QUYEN' || loan.currentStage !== 'THAM_DINH')
                    throw new common_1.ForbiddenException('Chỉ Thẩm quyền tại Thẩm định được yêu cầu làm rõ.');
                await (0, appraisal_logic_1.assertIndependent)(tx, loan, user);
            }
            let report = await tx.appraisalReport.findUnique({ where: { applicationId: id } });
            if (report) {
                const prior = await tx.appraisalReportEvent.findUnique({ where: { reportId_clientRequestId: { reportId: report.id, clientRequestId: body.clientRequestId } } });
                if (prior) {
                    if (prior.actorId !== user.id || prior.payloadHash !== payloadHash)
                        throw new common_1.ConflictException('Mã thao tác đã được dùng với nội dung khác.');
                    return;
                }
            }
            if ((report?.revision ?? 0) !== body.expectedRevision)
                throw new common_1.ConflictException('Tờ trình đã thay đổi. Vui lòng tải lại.');
            if (!report)
                report = await tx.appraisalReport.create({ data: { applicationId: id, draft: {} } });
            if (kind === 'CLARIFICATION_REQUESTED') {
                if (report.status !== 'SUBMITTED' || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000)
                    throw new common_1.BadRequestException('Cần nội dung làm rõ cụ thể cho bản đã trình.');
                await tx.appraisalReport.update({ where: { id: report.id }, data: { status: 'CLARIFICATION_REQUIRED', revision: { increment: 1 }, clarification: { message: body.message.trim(), actorId: user.id, at: new Date().toISOString() } } });
                await tx.internalNotification.create({ data: { userId: loan.assignedTo, applicationId: id, title: 'Tờ trình cần làm rõ', message: body.message.trim() } });
            }
            else {
                if (!['DRAFT', 'CLARIFICATION_REQUIRED'].includes(report.status))
                    throw new common_1.ConflictException('Bản đã trình được khóa. Chỉ sửa khi có yêu cầu làm rõ.');
                if (loan.currentStage !== 'TIEP_NHAN' && report.status !== 'CLARIFICATION_REQUIRED')
                    throw new common_1.ForbiddenException('Chưa mở quyền sửa tờ trình tại công đoạn này.');
                const content = (0, appraisal_logic_1.validateReport)(kind === 'DRAFT_SAVED' ? body.content : report.draft, kind === 'SUBMITTED');
                if (kind === 'SUBMITTED') {
                    if (loan.currentStatus === 'SUPPLEMENT_REQUIRED' || await tx.supplementRequest.count({ where: { applicationId: id, status: 'PENDING' } }))
                        throw new common_1.ConflictException('Cần hoàn tất bổ sung trước khi trình.');
                    if (loan.currentStage === 'TIEP_NHAN' && (!loan.isDocumentComplete || loan.currentStatus !== 'CHECKED'))
                        throw new common_1.BadRequestException('Cần xác nhận đủ chứng từ trước khi trình.');
                    if (!loan.officialAmount)
                        throw new common_1.BadRequestException('Cần xác nhận hạn mức chính thức trước khi trình.');
                    (0, loan_policy_1.assertBranchAmount)(loan.officialAmount);
                    const evidence = await (0, appraisal_logic_1.reportEvidence)(tx, loan);
                    const sequence = await tx.appraisalReportVersion.count({ where: { reportId: report.id } }) + 1;
                    await tx.appraisalReportVersion.create({ data: { reportId: report.id, sequence, content, evidence, evidenceHash: (0, appraisal_logic_1.digest)(evidence), submittedBy: user.id } });
                    await tx.appraisalReport.update({ where: { id: report.id }, data: { status: 'SUBMITTED', draft: content, revision: { increment: 1 } } });
                    if (loan.currentStage === 'TIEP_NHAN') {
                        await this.workflow.transitionStage(id, { targetStage: 'THAM_DINH', targetStatus: 'PENDING_APPRAISAL' }, user, new Date(), tx);
                        firstTransition = true;
                    }
                    const reviewers = await tx.user.findMany({ where: { isActive: true, roles: { some: { role: { code: 'THAM_QUYEN' } } } }, select: { id: true } });
                    for (const reviewer of reviewers)
                        if (reviewer.id !== user.id)
                            await tx.internalNotification.create({ data: { userId: reviewer.id, applicationId: id, title: 'Tờ trình chờ xem xét', message: `Hồ sơ ${loan.applicationCode} đã trình bản ${sequence}.` } });
                }
                else
                    await tx.appraisalReport.update({ where: { id: report.id }, data: { draft: content, revision: { increment: 1 } } });
            }
            await tx.appraisalReportEvent.create({ data: { reportId: report.id, actorId: user.id, kind, clientRequestId: body.clientRequestId, payloadHash, payload: kind === 'CLARIFICATION_REQUESTED' ? { message: body.message.trim() } : {} } });
        }, { timeout: 30000 });
        if (firstTransition)
            await this.prediction.predictForApplication(id).catch(() => undefined);
        return this.view(id);
    }
};
exports.AppraisalService = AppraisalService;
exports.AppraisalService = AppraisalService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, workflow_service_1.WorkflowService, prediction_service_1.PredictionService])
], AppraisalService);
//# sourceMappingURL=appraisal.service.js.map