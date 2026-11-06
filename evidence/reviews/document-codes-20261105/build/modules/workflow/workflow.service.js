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
var WorkflowService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma.service");
const assignment_coordination_1 = require("../assignments/assignment-coordination");
const prediction_service_1 = require("../prediction/prediction.service");
const supplement_deadlines_1 = require("../supplements/supplement-deadlines");
const portal_supplement_1 = require("../supplements/portal-supplement");
const sla_policy_1 = require("./sla/sla-policy");
const loan_policy_1 = require("./loan-policy");
const appraisal_logic_1 = require("../appraisal/appraisal.logic");
const portal_tracking_1 = require("../portal/portal.tracking");
let WorkflowService = WorkflowService_1 = class WorkflowService {
    prisma;
    predictionService;
    logger = new common_1.Logger(WorkflowService_1.name);
    constructor(prisma, predictionService) {
        this.prisma = prisma;
        this.predictionService = predictionService;
    }
    getWorkflowStages() { return this.prisma.workflowStage.findMany({ orderBy: { orderIndex: 'asc' } }); }
    async getWorkflowHistory(applicationId) {
        return this.prisma.applicationStageHistory.findMany({ where: { applicationId }, include: { stage: true, handler: { select: { id: true, fullName: true, username: true } } }, orderBy: { enteredAt: 'asc' } });
    }
    async transitionStage(applicationId, dto, user, clock = new Date(), transaction) {
        const run = async (tx) => {
            await tx.$queryRaw `SELECT id FROM loan_applications WHERE id = ${applicationId} FOR UPDATE`;
            const loan = await tx.loanApplication.findUnique({ where: { id: applicationId } });
            if (!loan)
                throw new common_1.NotFoundException('Không tìm thấy hồ sơ.');
            await (0, assignment_coordination_1.assertNoCoordinationConflict)(tx, { applicationId }, user.id, dto.targetStage === 'HOAN_TAT' && ['APPROVED', 'REJECTED'].includes(dto.targetStatus));
            if (loan.completedAt || loan.currentStage === client_1.StageCode.HOAN_TAT)
                throw new common_1.BadRequestException('Hồ sơ đã kết thúc, không thể chuyển trạng thái.');
            if (loan.currentStatus === client_1.LoanStatus.SUPPLEMENT_REQUIRED)
                throw new common_1.BadRequestException('Cần giải quyết yêu cầu bổ sung trước khi chuyển công đoạn.');
            const fromReception = loan.currentStage === client_1.StageCode.TIEP_NHAN;
            if (user.activeRole !== (fromReception ? 'CBTD' : 'THAM_QUYEN'))
                throw new common_1.ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
            if (fromReception && loan.assignedTo !== user.id)
                throw new common_1.ForbiddenException('Hồ sơ chưa được phân công cho bạn.');
            if (!fromReception && loan.assignedTo === user.id)
                throw new common_1.ForbiddenException('Bạn đã xử lý hồ sơ này ở công đoạn Tiếp nhận nên không được tự thẩm định hoặc phê duyệt.');
            let decidedReport = null;
            if (loan.businessPolicyVersion) {
                (0, loan_policy_1.assertBranchAmount)(loan.officialAmount || loan.proposedAmount);
                if (fromReception) {
                    const report = await tx.appraisalReport.findUnique({ where: { applicationId } });
                    if (report?.status !== 'SUBMITTED')
                        throw new common_1.BadRequestException('Cần lập và trình tờ trình trước khi chuyển Thẩm định.');
                }
                else {
                    decidedReport = await (0, appraisal_logic_1.assertReportDecision)(tx, loan, user, dto.reportVersionId);
                }
            }
            const amount = Number(loan.officialAmount || loan.proposedAmount);
            if (fromReception) {
                if (dto.targetStage !== client_1.StageCode.THAM_DINH || dto.targetStatus !== client_1.LoanStatus.PENDING_APPRAISAL)
                    throw new common_1.BadRequestException('Tiếp nhận chỉ được chuyển sang Thẩm định.');
                if (!loan.isDocumentComplete || loan.currentStatus !== client_1.LoanStatus.CHECKED)
                    throw new common_1.BadRequestException('Cần xác nhận đầy đủ chứng từ trước khi chuyển thẩm định.');
            }
            else if (dto.targetStage === client_1.StageCode.HOAN_TAT && dto.targetStatus === client_1.LoanStatus.REJECTED) {
                if (!(0, portal_tracking_1.isPublicRejectionReasonCode)(dto.rejectionReasonCode))
                    throw new common_1.BadRequestException('Mã lý do từ chối không hợp lệ. Phải thuộc danh mục chuẩn TC01-TC05.');
                if (!dto.rejectionNote?.trim())
                    throw new common_1.BadRequestException('Cần mã và lý do từ chối.');
            }
            else if (dto.targetStage === client_1.StageCode.HOAN_TAT && dto.targetStatus === client_1.LoanStatus.APPROVED) {
                if (amount > 10000000000)
                    throw new common_1.BadRequestException('Khoản vay vượt hạn mức chi nhánh (tối đa 10 tỷ), không thể phê duyệt.');
                if (!Number.isFinite(dto.approvedAmount) || dto.approvedAmount <= 0 || dto.approvedAmount > amount)
                    throw new common_1.BadRequestException('Số tiền phê duyệt phải dương và không vượt hạn mức.');
                if (!Number.isFinite(dto.interestRate) || dto.interestRate < 0 || dto.interestRate > 100)
                    throw new common_1.BadRequestException('Lãi suất phải từ 0 đến 100%.');
            }
            else
                throw new common_1.BadRequestException('Cặp công đoạn và trạng thái không hợp lệ.');
            if (dto.officialAmount !== undefined)
                throw new common_1.BadRequestException('Xác định hạn mức ở công đoạn tiếp nhận, trước khi chuyển thẩm định.');
            const target = await tx.workflowStage.findUnique({ where: { stageCode: dto.targetStage } });
            if (!target)
                throw new common_1.BadRequestException('Chưa cấu hình công đoạn đích.');
            if (decidedReport) {
                await tx.appraisalReport.update({ where: { id: decidedReport.report.id }, data: { status: 'DECIDED', decidedVersionId: decidedReport.version.id, revision: { increment: 1 } } });
            }
            const now = clock;
            const terminal = dto.targetStage === client_1.StageCode.HOAN_TAT;
            if (terminal)
                await (0, assignment_coordination_1.obsoleteCoordination)(tx, { applicationId }, 'LOAN_COMPLETED');
            const mode = await (0, sla_policy_1.resolveStageSla)(tx, now, !terminal);
            const current = await tx.applicationStageHistory.findFirst({ where: { applicationId, exitedAt: null }, orderBy: { enteredAt: 'desc' } });
            if (current) {
                const closing = (0, sla_policy_1.computeStageClosing)(current, await (0, sla_policy_1.loadPauseIntervals)(tx, current.id, current.slaPolicy), now);
                await tx.applicationStageHistory.update({ where: { id: current.id }, data: { exitedAt: now, ...closing, handledBy: user.id } });
            }
            await tx.applicationStageHistory.create({ data: {
                    applicationId, stageId: target.id, enteredAt: now, slaStandardHours: target.standardSlaHours,
                    handledBy: user.id, notes: dto.notes, ...mode,
                    ...(terminal ? { exitedAt: now, actualDurationHours: 0, netWorkDurationHours: 0 } : {}),
                } });
            return tx.loanApplication.update({ where: { id: applicationId }, data: {
                    currentStage: dto.targetStage, currentStatus: dto.targetStatus,
                    completedAt: terminal ? now : null,
                    ...(dto.targetStatus === client_1.LoanStatus.APPROVED ? { approvedAmount: dto.approvedAmount, interestRate: dto.interestRate } : {}),
                    ...(dto.targetStatus === client_1.LoanStatus.REJECTED ? { rejectionReasonCode: dto.rejectionReasonCode, rejectionNote: dto.rejectionNote } : {}),
                } });
        };
        const updated = transaction ? await run(transaction) : await this.prisma.$transaction(run);
        if (!transaction && updated.currentStage !== client_1.StageCode.HOAN_TAT) {
            try {
                await this.predictionService.predictForApplication(applicationId);
            }
            catch (err) {
                this.logger.warn(`Không cập nhật được dự báo AI: ${err.message}`);
            }
        }
        return updated;
    }
    async closeOverdueSupplement(applicationId, dto, user, now = new Date()) {
        if (user.activeRole !== 'QUAN_LY')
            throw new common_1.ForbiddenException('Chỉ Quản lý được đóng hồ sơ quá hạn bổ sung.');
        const reason = dto.reason?.trim();
        if (!reason)
            throw new common_1.BadRequestException('Cần nhập lý do đóng hồ sơ.');
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM loan_applications WHERE id = ${applicationId} FOR UPDATE`;
            const loan = await tx.loanApplication.findUnique({ where: { id: applicationId } });
            if (!loan)
                throw new common_1.NotFoundException('Không tìm thấy hồ sơ.');
            await (0, assignment_coordination_1.assertNoCoordinationConflict)(tx, { applicationId }, user.id);
            if (loan.assignedTo === user.id || (loan.intakeOfficerId && loan.intakeOfficerId === user.id)) {
                throw new common_1.ForbiddenException('Bạn đang phụ trách hoặc là người tiếp nhận ban đầu của hồ sơ này nên không được tự đóng hồ sơ.');
            }
            if (loan.completedAt || loan.currentStage === client_1.StageCode.HOAN_TAT)
                throw new common_1.BadRequestException('Hồ sơ đã kết thúc.');
            if (loan.currentStatus !== client_1.LoanStatus.SUPPLEMENT_REQUIRED)
                throw new common_1.BadRequestException('Chỉ đóng được hồ sơ đang chờ bổ sung.');
            const pending = await tx.supplementRequest.findMany({ where: { applicationId, status: client_1.SupplementStatus.PENDING } });
            if (!pending.some(item => (0, portal_supplement_1.waitingOn)(item) === 'ENTERPRISE' && (0, supplement_deadlines_1.overdueAt)(item.requestedAt, item.deadlineAt).getTime() <= now.getTime())) {
                throw new common_1.BadRequestException('Hồ sơ chưa quá hạn bổ sung.');
            }
            const target = await tx.workflowStage.findUnique({ where: { stageCode: client_1.StageCode.HOAN_TAT } });
            if (!target)
                throw new common_1.BadRequestException('Chưa cấu hình công đoạn kết thúc.');
            await tx.supplementRequest.updateMany({ where: { applicationId, status: client_1.SupplementStatus.PENDING }, data: { status: client_1.SupplementStatus.EXPIRED } });
            const mode = await (0, sla_policy_1.resolveStageSla)(tx, now, false);
            const current = await tx.applicationStageHistory.findFirst({ where: { applicationId, exitedAt: null }, orderBy: { enteredAt: 'desc' } });
            if (current) {
                const closing = (0, sla_policy_1.computeStageClosing)(current, await (0, sla_policy_1.loadPauseIntervals)(tx, current.id, current.slaPolicy), now);
                await tx.applicationStageHistory.update({ where: { id: current.id }, data: { exitedAt: now, pausedAt: null, ...closing, handledBy: user.id } });
                await tx.applicationStagePause.updateMany({ where: { historyId: current.id, endedAt: null }, data: { endedAt: now } });
            }
            await tx.applicationStageHistory.create({ data: {
                    applicationId, stageId: target.id, enteredAt: now, exitedAt: now, actualDurationHours: 0, netWorkDurationHours: 0,
                    slaStandardHours: target.standardSlaHours, handledBy: user.id, ...mode,
                    notes: `Đóng hồ sơ do quá hạn bổ sung: ${reason}`,
                } });
            await (0, assignment_coordination_1.obsoleteCoordination)(tx, { applicationId }, 'LOAN_COMPLETED');
            return tx.loanApplication.update({ where: { id: applicationId }, data: {
                    currentStage: client_1.StageCode.HOAN_TAT, currentStatus: client_1.LoanStatus.CLOSED_TIMEOUT, completedAt: now, rejectionReasonCode: 'TC05', rejectionNote: reason, updatedAt: now,
                } });
        });
    }
};
exports.WorkflowService = WorkflowService;
exports.WorkflowService = WorkflowService = WorkflowService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, prediction_service_1.PredictionService])
], WorkflowService);
//# sourceMappingURL=workflow.service.js.map