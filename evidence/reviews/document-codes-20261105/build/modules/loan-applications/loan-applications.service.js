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
exports.LoanApplicationsService = void 0;
const assignment_coordination_1 = require("../assignments/assignment-coordination");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
const client_1 = require("@prisma/client");
const document_codes_1 = require("../../common/document-codes");
const company_access_1 = require("../companies/company-access");
const company_snapshot_1 = require("../companies/company-snapshot");
const sla_policy_1 = require("../workflow/sla/sla-policy");
const prediction_status_1 = require("../prediction/prediction-status");
const loan_policy_1 = require("../workflow/loan-policy");
let LoanApplicationsService = class LoanApplicationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(dto, creatorUserId, clock = new Date()) {
        (0, loan_policy_1.assertBranchAmount)(dto.proposedAmount);
        if (dto.assignedTo && dto.assignedTo !== creatorUserId)
            throw new common_1.BadRequestException('Hồ sơ mới được gán cho cán bộ tiếp nhận. Dùng chức năng điều chuyển để đổi người phụ trách.');
        return this.prisma.$transaction(async (tx) => {
            await (0, loan_policy_1.lockOfficer)(tx, creatorUserId);
            const actor = await tx.user.findFirst({ where: { id: creatorUserId, isActive: true, roles: { some: { role: { code: 'CBTD' } } } } });
            if (!actor)
                throw new common_1.BadRequestException('CBTD không còn hoạt động hoặc đã mất quyền.');
            await (0, assignment_coordination_1.assertNoCompanyConflict)(tx, creatorUserId, dto.taxCode);
            await (0, company_snapshot_1.lockCompany)(tx, dto.taxCode);
            await (0, company_access_1.assertOfficerMayWriteCompany)(tx, dto.taxCode, creatorUserId);
            const company = await tx.company.upsert({
                where: { taxCode: dto.taxCode },
                update: {
                    companyName: dto.companyName,
                    industry: dto.industry,
                    establishedYear: dto.establishedYear,
                    annualRevenue: dto.annualRevenue,
                    charterCapital: dto.charterCapital,
                    representativeName: dto.representativeName,
                    phone: dto.phone,
                    address: dto.address,
                },
                create: {
                    taxCode: dto.taxCode,
                    companyName: dto.companyName,
                    industry: dto.industry,
                    establishedYear: dto.establishedYear,
                    annualRevenue: dto.annualRevenue,
                    charterCapital: dto.charterCapital,
                    representativeName: dto.representativeName,
                    phone: dto.phone,
                    address: dto.address,
                },
            });
            const applicationCode = await (0, document_codes_1.nextDocumentCode)(tx, 'SME');
            const stageTiepNhan = await tx.workflowStage.findUnique({
                where: { stageCode: client_1.StageCode.TIEP_NHAN },
            });
            if (!stageTiepNhan)
                throw new common_1.BadRequestException('Chưa cấu hình công đoạn Tiếp nhận. Vui lòng liên hệ Admin.');
            const standardSla = stageTiepNhan.standardSlaHours;
            const slaMode = await (0, sla_policy_1.resolveStageSla)(tx, clock);
            const assignedUser = dto.assignedTo || creatorUserId;
            const loan = await tx.loanApplication.create({
                data: {
                    applicationCode,
                    businessPolicyVersion: loan_policy_1.BRANCH_POLICY, intakeOfficerId: creatorUserId,
                    companyId: company.id,
                    companySnapshot: (0, company_snapshot_1.companySnapshot)(company),
                    loanPurpose: dto.loanPurpose,
                    loanType: dto.loanType,
                    proposedAmount: dto.proposedAmount,
                    loanTermMonths: dto.loanTermMonths,
                    currentStage: client_1.StageCode.TIEP_NHAN,
                    currentStatus: client_1.LoanStatus.RECEIVED,
                    assignedTo: assignedUser,
                    isDocumentComplete: false,
                    supplementCount: 0,
                    stageHistories: {
                        create: {
                            stageId: stageTiepNhan.id,
                            enteredAt: clock,
                            slaStandardHours: standardSla,
                            ...slaMode,
                            handledBy: assignedUser,
                            notes: 'Tiếp nhận hồ sơ mới vào hệ thống',
                        },
                    },
                },
                include: {
                    company: true,
                    assignedUser: {
                        select: { id: true, fullName: true, username: true },
                    },
                },
            });
            return {
                message: 'Tiếp nhận hồ sơ thành công',
                loan: (0, company_snapshot_1.withLoanCompany)(loan),
            };
        });
    }
    async findAll(user, query) {
        if (query.stage && !Object.values(client_1.StageCode).includes(query.stage))
            throw new common_1.BadRequestException('Công đoạn không hợp lệ.');
        if (query.status && !Object.values(client_1.LoanStatus).includes(query.status))
            throw new common_1.BadRequestException('Trạng thái không hợp lệ.');
        const isCbtdOnly = user.roles.length === 1 && user.roles.includes(client_1.RoleCode.CBTD);
        const assignedFilter = isCbtdOnly || query.myOnly ? user.id : undefined;
        const stageFilter = user.activeRole === client_1.RoleCode.THAM_QUYEN
            ? { not: client_1.StageCode.TIEP_NHAN, ...(query.stage ? { equals: query.stage } : {}) }
            : query.stage;
        const loans = await this.prisma.loanApplication.findMany({
            where: {
                assignedTo: assignedFilter,
                currentStage: stageFilter,
                currentStatus: query.status,
                OR: query.keyword
                    ? [
                        { applicationCode: { contains: query.keyword, mode: 'insensitive' } },
                        { company: { companyName: { contains: query.keyword, mode: 'insensitive' } } },
                        { companySnapshot: { path: ['companyName'], string_contains: query.keyword, mode: 'insensitive' } },
                        { company: { taxCode: { contains: query.keyword } } },
                    ]
                    : undefined,
            },
            include: {
                company: true,
                assignedUser: {
                    select: { id: true, fullName: true, username: true, email: true },
                },
                delayPredictions: {
                    orderBy: { predictionTimestamp: 'desc' },
                    take: 1,
                },
                stageHistories: {
                    orderBy: { enteredAt: 'desc' },
                    take: 1,
                    include: { stage: true },
                },
                supplementRequests: {
                    where: { status: 'PENDING' },
                    select: { id: true, status: true, requestedAt: true, deadlineAt: true, reminderSentAt: true, overdueAt: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const policies = await (0, prediction_status_1.firstStagePolicies)(this.prisma, loans.map(loan => loan.id));
        return loans.map(loan => ({ ...(0, company_snapshot_1.withLoanCompany)(loan), predictionStatus: (0, prediction_status_1.predictionStatusOf)(loan.delayPredictions.length > 0, policies.get(loan.id)) }));
    }
    async findOne(id, now = new Date(), actor) {
        const loan = await this.prisma.loanApplication.findUnique({
            where: { id },
            include: {
                company: true,
                portalRequest: { include: { documents: { where: { withdrawnAt: null, nextVersion: { is: null } }, select: { id: true, documentGroup: true, fileName: true, fileSize: true, uploadedAt: true, coverage: true, version: true, supersedesId: true, withdrawnAt: true } } } },
                assignedUser: {
                    select: { id: true, fullName: true, username: true, email: true, phone: true },
                },
                stageHistories: {
                    orderBy: { enteredAt: 'asc' },
                    include: {
                        stage: true,
                        handler: { select: { fullName: true, username: true } },
                    },
                },
                documents: {
                    include: {
                        uploader: { select: { fullName: true } },
                    },
                    orderBy: { uploadedAt: 'desc' },
                },
                supplementRequests: {
                    include: {
                        requester: { select: { fullName: true } },
                    },
                    orderBy: { requestedAt: 'desc' },
                },
                delayPredictions: {
                    orderBy: { predictionTimestamp: 'desc' },
                    take: 1,
                },
                assignments: {
                    include: {
                        fromUser: { select: { fullName: true } },
                        toUser: { select: { fullName: true } },
                        manager: { select: { fullName: true } },
                    },
                    orderBy: { reassignedAt: 'desc' },
                },
            },
        });
        if (!loan)
            throw new common_1.NotFoundException('Không tìm thấy hồ sơ vay.');
        const open = loan.stageHistories.find(h => h.exitedAt === null);
        const isPa1 = open?.slaPolicy === sla_policy_1.SLA_POLICY_PA1;
        const pauses = isPa1 ? await this.prisma.applicationStagePause.findMany({ where: { historyId: open.id }, orderBy: { startedAt: 'asc' } }) : [];
        const pauseOpen = pauses.some(pause => pause.endedAt === null);
        let liveSla = null;
        if (open && isPa1) {
            try {
                liveSla = { historyId: open.id, ...(0, sla_policy_1.computeStageClosing)(open, pauses.map(p => ({ start: p.startedAt, end: p.endedAt })), now) };
            }
            catch (error) {
                liveSla = { historyId: open.id, error: error.message };
            }
        }
        const supplementOpen = loan.currentStatus === client_1.LoanStatus.SUPPLEMENT_REQUIRED;
        const slaState = {
            policy: open?.slaPolicy ?? null,
            calendarVersion: open?.slaCalendarVersion ?? null,
            waiting: supplementOpen ? (isPa1 ? (pauseOpen ? 'ENTERPRISE' : 'BANK') : 'ENTERPRISE') : null,
            slaRunning: open ? (isPa1 ? !pauseOpen : !open.pausedAt) : false,
        };
        return {
            ...(0, company_snapshot_1.withLoanCompany)(loan),
            source: loan.portalRequest ? 'PORTAL' : 'QUAY',
            coordinationRestrictions: await this.coordinationRestrictions(id, actor?.id),
            makerCheckerRestrictions: await this.makerCheckerRestrictions(loan, actor?.id),
            predictionStatus: (0, prediction_status_1.predictionStatusOf)(loan.delayPredictions.length > 0, loan.stageHistories[0]?.slaPolicy),
            slaState,
            liveSla,
        };
    }
    async makerCheckerRestrictions(loan, actorId) {
        if (!actorId) {
            return {
                isIndependent: true,
                decisionBlocked: false,
                decisionBlockReason: null,
                canCloseOverdue: true,
                closeOverdueBlockReason: null,
            };
        }
        let canCloseOverdue = true;
        let closeOverdueBlockReason = null;
        if (loan.assignedTo === actorId) {
            canCloseOverdue = false;
            closeOverdueBlockReason = 'Bạn đang phụ trách hồ sơ này nên không được đóng hồ sơ quá hạn (Maker-Checker).';
        }
        else if (loan.intakeOfficerId && loan.intakeOfficerId === actorId) {
            canCloseOverdue = false;
            closeOverdueBlockReason = 'Bạn là người tiếp nhận ban đầu của hồ sơ này nên không được đóng hồ sơ quá hạn (Maker-Checker).';
        }
        let isIndependent = true;
        let decisionBlockReason = null;
        if (loan.assignedTo === actorId) {
            isIndependent = false;
            decisionBlockReason = 'Bạn đang phụ trách hồ sơ này nên không được tự quyết định hoặc yêu cầu làm rõ (Maker-Checker).';
        }
        else if (loan.intakeOfficerId && loan.intakeOfficerId === actorId) {
            isIndependent = false;
            decisionBlockReason = 'Bạn là người tiếp nhận ban đầu của hồ sơ này nên không được tự quyết định hoặc yêu cầu làm rõ (Maker-Checker).';
        }
        else {
            const authored = await this.prisma.appraisalReportEvent.findFirst({
                where: {
                    report: { applicationId: loan.id },
                    actorId,
                    kind: { in: ['DRAFT_SAVED', 'SUBMITTED'] },
                },
            });
            if (authored) {
                isIndependent = false;
                decisionBlockReason = 'Bạn đã tham gia lập hoặc sửa tờ trình nên không được tự quyết định hoặc yêu cầu làm rõ (Maker-Checker).';
            }
        }
        return {
            isIndependent,
            decisionBlocked: !isIndependent,
            decisionBlockReason,
            canCloseOverdue,
            closeOverdueBlockReason,
        };
    }
    async coordinationRestrictions(id, actorId) {
        const pending = await this.prisma.assignmentChangeRequest.findMany({ where: { applicationId: id, status: 'PENDING', reasonCode: 'CONFLICT_OF_INTEREST' }, select: { requestedById: true } });
        return { writeBlocked: pending.some(r => r.requestedById === actorId), decisionBlocked: pending.length > 0 };
    }
    async checkDocuments(id, isComplete, actor) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM loan_applications WHERE id = ${id} FOR UPDATE`;
            const loan = await tx.loanApplication.findUnique({ where: { id } });
            if (!loan)
                throw new common_1.NotFoundException('Hồ sơ không tồn tại.');
            await (0, loan_policy_1.assertLoanWrite)(tx, loan, actor, true);
            if (typeof isComplete !== 'boolean')
                throw new common_1.BadRequestException('isComplete phải là giá trị boolean.');
            if (loan.currentStage !== client_1.StageCode.TIEP_NHAN || loan.currentStatus === client_1.LoanStatus.SUPPLEMENT_REQUIRED)
                throw new common_1.BadRequestException('Chỉ kiểm tra chứng từ tại công đoạn Tiếp nhận khi không chờ bổ sung.');
            const updated = await tx.loanApplication.update({
                where: { id },
                data: {
                    isDocumentComplete: isComplete,
                    currentStatus: isComplete ? client_1.LoanStatus.CHECKED : client_1.LoanStatus.RECEIVED,
                },
            });
            return {
                message: isComplete ? 'Xác nhận hồ sơ đã đầy đủ chứng từ' : 'Đã hủy xác nhận đầy đủ chứng từ',
                loan: updated,
            };
        });
    }
    async setOfficialAmount(id, officialAmount, actor) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM loan_applications WHERE id = ${id} FOR UPDATE`;
            const loan = await tx.loanApplication.findUnique({ where: { id } });
            if (!loan)
                throw new common_1.NotFoundException('Hồ sơ không tồn tại.');
            await (0, loan_policy_1.assertLoanWrite)(tx, loan, actor, true);
            if (loan.currentStage !== client_1.StageCode.TIEP_NHAN || loan.currentStatus === client_1.LoanStatus.SUPPLEMENT_REQUIRED)
                throw new common_1.BadRequestException('Chỉ xác định hạn mức tại công đoạn Tiếp nhận khi không chờ bổ sung.');
            if (loan.businessPolicyVersion)
                (0, loan_policy_1.assertBranchAmount)(officialAmount);
            if (!Number.isFinite(officialAmount) || officialAmount <= 0) {
                throw new common_1.BadRequestException('Hạn mức vay phải là số dương hợp lệ.');
            }
            const updated = await tx.loanApplication.update({
                where: { id },
                data: {
                    officialAmount,
                },
            });
            const isExceedLimit = officialAmount > 10000000000;
            return {
                message: 'Đã xác định hạn mức khoản vay thành công',
                loan: updated,
                isExceedLimit,
                nextAction: 'CHUYEN_THAM_DINH',
            };
        });
    }
};
exports.LoanApplicationsService = LoanApplicationsService;
exports.LoanApplicationsService = LoanApplicationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LoanApplicationsService);
//# sourceMappingURL=loan-applications.service.js.map