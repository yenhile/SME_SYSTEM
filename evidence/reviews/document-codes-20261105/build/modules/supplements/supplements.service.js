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
var SupplementsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplementsService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const portal_supplement_1 = require("./portal-supplement");
const prisma_service_1 = require("../../prisma.service");
const prediction_service_1 = require("../prediction/prediction.service");
const client_1 = require("@prisma/client");
const sla_policy_1 = require("../workflow/sla/sla-policy");
const loan_policy_1 = require("../workflow/loan-policy");
let SupplementsService = SupplementsService_1 = class SupplementsService {
    prisma;
    predictionService;
    logger = new common_1.Logger(SupplementsService_1.name);
    constructor(prisma, predictionService) {
        this.prisma = prisma;
        this.predictionService = predictionService;
    }
    async createSupplementRequest(applicationId, dto, userId, activeRole, clock = new Date()) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM loan_applications WHERE id = ${applicationId} FOR UPDATE`;
            const loan = await tx.loanApplication.findUnique({
                where: { id: applicationId },
            });
            if (!loan) {
                throw new common_1.NotFoundException(`Không tìm thấy hồ sơ với ID: ${applicationId}`);
            }
            await (0, loan_policy_1.assertLoanWrite)(tx, loan, { id: userId, activeRole: activeRole ?? (loan.currentStage === 'TIEP_NHAN' ? 'CBTD' : 'THAM_QUYEN') });
            let portalSupplement;
            if (dto.items !== undefined) {
                if (activeRole !== (loan.currentStage === client_1.StageCode.TIEP_NHAN ? 'CBTD' : 'THAM_QUYEN'))
                    throw new common_1.ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
                if (loan.currentStage === client_1.StageCode.TIEP_NHAN && loan.assignedTo !== userId)
                    throw new common_1.ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
                portalSupplement = (0, portal_supplement_1.createMetadata)(dto.items, dto.clientRequestId);
                const fingerprint = (0, node_crypto_1.createHash)('sha256').update(JSON.stringify({ requestContent: dto.requestContent, deadlineAt: dto.deadlineAt ?? null, notes: dto.notes ?? null, items: dto.items.map(item => ({ documentGroup: item.documentGroup, documentTypeCode: item.documentTypeCode, period: item.period ?? null, reason: item.reason })) })).digest('hex');
                const linked = await tx.portalRequest.findFirst({ where: { loanId: applicationId, status: 'ACCEPTED' } });
                if (!linked)
                    throw new common_1.BadRequestException('Bổ sung qua portal chỉ áp dụng hồ sơ đã tiếp nhận và liên kết Loan.');
                const previous = await tx.supplementRequest.findMany({ where: { applicationId } });
                const retry = previous.find(r => r.portalSupplement?.createId === dto.clientRequestId);
                if (retry) {
                    if (retry.portalSupplement.createHash !== fingerprint)
                        throw new common_1.ConflictException('Mã thao tác đã dùng cho nội dung khác.');
                    return (0, portal_supplement_1.safeView)(retry);
                }
                portalSupplement.createHash = fingerprint;
            }
            else if (dto.clientRequestId !== undefined)
                throw new common_1.BadRequestException('clientRequestId yêu cầu danh sách items.');
            if (loan.currentStatus === client_1.LoanStatus.SUPPLEMENT_REQUIRED) {
                throw new common_1.BadRequestException('Hồ sơ hiện đang trong trạng thái chờ bổ sung chứng từ.');
            }
            if (loan.completedAt || loan.currentStage === client_1.StageCode.HOAN_TAT)
                throw new common_1.BadRequestException('Hồ sơ đã kết thúc.');
            const now = clock;
            const request = await tx.supplementRequest.create({
                data: {
                    applicationId,
                    requestContent: dto.requestContent,
                    requestedBy: userId,
                    requestedAt: now,
                    deadlineAt: dto.deadlineAt ? new Date(dto.deadlineAt) : null,
                    status: client_1.SupplementStatus.PENDING,
                    notes: dto.notes,
                    ...(portalSupplement ? { portalSupplement } : {}),
                },
                include: {
                    requester: {
                        select: { id: true, fullName: true, username: true },
                    },
                },
            });
            await tx.loanApplication.update({
                where: { id: applicationId },
                data: {
                    currentStatus: client_1.LoanStatus.SUPPLEMENT_REQUIRED,
                    isDocumentComplete: false,
                    supplementCount: { increment: 1 },
                    updatedAt: now,
                },
            });
            const activeStage = await tx.applicationStageHistory.findFirst({
                where: {
                    applicationId,
                    exitedAt: null,
                },
                orderBy: { enteredAt: 'desc' },
            });
            if (activeStage && !activeStage.pausedAt) {
                await tx.applicationStageHistory.update({
                    where: { id: activeStage.id },
                    data: { pausedAt: now },
                });
                this.logger.log(`Tạm dừng đo SLA công đoạn cho hồ sơ ${loan.applicationCode}`);
            }
            await (0, sla_policy_1.openStagePause)(tx, applicationId, now, 'WAIT_ENTERPRISE', request.id);
            return portalSupplement ? (0, portal_supplement_1.safeView)(request) : request;
        });
    }
    async resolveSupplementRequest(supplementId, dto, userId, activeRole, clock = new Date()) {
        const initial = await this.prisma.supplementRequest.findUnique({ where: { id: supplementId } });
        if (!initial)
            throw new common_1.NotFoundException('Yêu cầu bổ sung không tồn tại.');
        let changed = false;
        const updatedRequest = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM loan_applications WHERE id = ${initial.applicationId} FOR UPDATE`;
            await tx.$queryRaw `SELECT id FROM supplement_requests WHERE id = ${supplementId} FOR UPDATE`;
            const request = await tx.supplementRequest.findUnique({
                where: { id: supplementId },
                include: { application: true },
            });
            if (!request) {
                throw new common_1.NotFoundException(`Không tìm thấy yêu cầu bổ sung ID: ${supplementId}`);
            }
            await (0, loan_policy_1.assertLoanWrite)(tx, request.application, { id: userId, activeRole: activeRole ?? (request.application.currentStage === 'TIEP_NHAN' ? 'CBTD' : 'THAM_QUYEN') });
            let m;
            if (request.portalSupplement) {
                if (activeRole !== (request.application.currentStage === client_1.StageCode.TIEP_NHAN ? 'CBTD' : 'THAM_QUYEN'))
                    throw new common_1.ForbiddenException('Vai trò đang dùng không được xử lý công đoạn này.');
                if (request.application.currentStage === client_1.StageCode.TIEP_NHAN && request.application.assignedTo !== userId)
                    throw new common_1.ForbiddenException('Bạn chỉ được truy cập hồ sơ được phân công.');
                m = (0, portal_supplement_1.metadata)(request);
                const fingerprint = (0, node_crypto_1.createHash)('sha256').update(JSON.stringify({ notes: dto.notes ?? null })).digest('hex');
                if ((0, portal_supplement_1.replay)(m, dto.clientRequestId, 'resolve', fingerprint))
                    return (0, portal_supplement_1.safeView)(request);
                (0, portal_supplement_1.revision)(m, dto.expectedRevision);
                if (m.items.some((i) => i.status !== 'ACCEPTED'))
                    throw new common_1.BadRequestException('Cần chấp nhận tất cả mục bổ sung trước khi hoàn tất.');
                m.operations.push({ id: dto.clientRequestId, kind: 'resolve', hash: fingerprint });
                m.revision++;
                m.events.push({ type: 'RESOLVED', at: new Date().toISOString() });
            }
            if (request.status !== client_1.SupplementStatus.PENDING) {
                throw new common_1.BadRequestException('Yêu cầu bổ sung này đã được xử lý hoàn tất trước đó.');
            }
            if (request.application.completedAt || request.application.currentStage === client_1.StageCode.HOAN_TAT)
                throw new common_1.BadRequestException('Hồ sơ đã kết thúc.');
            const now = clock;
            const updatedRequest = await tx.supplementRequest.update({
                where: { id: supplementId, ...(m ? { portalSupplement: { equals: request.portalSupplement } } : {}) },
                data: {
                    status: client_1.SupplementStatus.RESOLVED,
                    resolvedAt: now,
                    notes: dto.notes ? `${request.notes ? request.notes + '\n' : ''}${dto.notes}` : request.notes,
                    ...(m ? { portalSupplement: m } : {}),
                },
            });
            const activeStage = await tx.applicationStageHistory.findFirst({
                where: {
                    applicationId: request.applicationId,
                    exitedAt: null,
                },
                orderBy: { enteredAt: 'desc' },
            });
            if (activeStage && activeStage.slaPolicy === sla_policy_1.SLA_POLICY_PA1) {
                await (0, sla_policy_1.closeStagePause)(tx, request.applicationId, now);
            }
            else if (activeStage && activeStage.pausedAt) {
                const pausedTime = new Date(activeStage.pausedAt).getTime();
                const additionalPausedHours = Math.round(((now.getTime() - pausedTime) / (1000 * 60 * 60)) * 10) / 10;
                const totalPausedHours = Math.round((activeStage.pausedDurationHours + additionalPausedHours) * 10) / 10;
                await tx.applicationStageHistory.update({
                    where: { id: activeStage.id },
                    data: {
                        pausedAt: null,
                        pausedDurationHours: totalPausedHours,
                    },
                });
                this.logger.log(`Kích hoạt lại đo SLA. Tổng thời gian tạm dừng tích lũy: ${totalPausedHours} giờ`);
            }
            let nextStatus = client_1.LoanStatus.PENDING_APPRAISAL;
            if (request.application.currentStage === client_1.StageCode.TIEP_NHAN) {
                nextStatus = client_1.LoanStatus.RECEIVED;
            }
            await tx.loanApplication.update({
                where: { id: request.applicationId },
                data: {
                    currentStatus: nextStatus,
                    updatedAt: now,
                },
            });
            changed = true;
            return m ? (0, portal_supplement_1.safeView)(updatedRequest) : updatedRequest;
        });
        try {
            if (!changed)
                return updatedRequest;
            this.logger.log(`Cập nhật dự báo AI sau khi nhận chứng từ bổ sung cho hồ sơ ${initial.applicationId}`);
            await this.predictionService.predictForApplication(initial.applicationId);
        }
        catch (err) {
            this.logger.warn(`Lỗi khi cập nhật dự báo AI: ${err.message}`);
        }
        return updatedRequest;
    }
    async getSupplements(applicationId) {
        return this.prisma.supplementRequest.findMany({
            where: { applicationId },
            include: {
                requester: {
                    select: { id: true, fullName: true, username: true },
                },
            },
            orderBy: { requestedAt: 'desc' },
        });
    }
};
exports.SupplementsService = SupplementsService;
exports.SupplementsService = SupplementsService = SupplementsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        prediction_service_1.PredictionService])
], SupplementsService);
//# sourceMappingURL=supplements.service.js.map