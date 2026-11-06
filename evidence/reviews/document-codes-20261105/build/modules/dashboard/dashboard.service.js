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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
const client_1 = require("@prisma/client");
const portal_supplement_1 = require("../supplements/portal-supplement");
const prediction_status_1 = require("../prediction/prediction-status");
const sla_policy_1 = require("../workflow/sla/sla-policy");
const supplement_deadlines_1 = require("../supplements/supplement-deadlines");
const company_snapshot_1 = require("../companies/company-snapshot");
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOverviewStats() {
        const activeStatuses = [
            client_1.LoanStatus.RECEIVED,
            client_1.LoanStatus.CHECKED,
            client_1.LoanStatus.SUPPLEMENT_REQUIRED,
            client_1.LoanStatus.PENDING_APPRAISAL,
        ];
        const [totalApplications, activeApplications, approvedApplications, rejectedApplications, timeoutApplications, totalCompletedStages, delayedStages, highRiskLoans, totalCompletedStagesPa1, delayedStagesPa1,] = await Promise.all([
            this.prisma.loanApplication.count(),
            this.prisma.loanApplication.count({ where: { currentStatus: { in: activeStatuses } } }),
            this.prisma.loanApplication.count({ where: { currentStatus: client_1.LoanStatus.APPROVED } }),
            this.prisma.loanApplication.count({ where: { currentStatus: client_1.LoanStatus.REJECTED } }),
            this.prisma.loanApplication.count({ where: { currentStatus: client_1.LoanStatus.CLOSED_TIMEOUT } }),
            this.prisma.applicationStageHistory.count({ where: { exitedAt: { not: null }, slaPolicy: null } }),
            this.prisma.applicationStageHistory.count({ where: { exitedAt: { not: null }, slaPolicy: null, isDelayed: true } }),
            this.prisma.loanApplication.count({
                where: {
                    currentStatus: { in: activeStatuses },
                    delayPredictions: {
                        some: { riskLevel: client_1.RiskLevel.CAO },
                    },
                },
            }),
            this.prisma.applicationStageHistory.count({ where: { exitedAt: { not: null }, slaPolicy: sla_policy_1.SLA_POLICY_PA1 } }),
            this.prisma.applicationStageHistory.count({ where: { exitedAt: { not: null }, slaPolicy: sla_policy_1.SLA_POLICY_PA1, isDelayed: true } }),
        ]);
        const slaOnTimeRate = totalCompletedStages > 0
            ? Math.round(((totalCompletedStages - delayedStages) / totalCompletedStages) * 1000) / 10
            : 100;
        const slaOnTimeRatePa1 = totalCompletedStagesPa1 > 0
            ? Math.round(((totalCompletedStagesPa1 - delayedStagesPa1) / totalCompletedStagesPa1) * 1000) / 10
            : null;
        return {
            totalApplications,
            activeApplications,
            approvedApplications,
            rejectedApplications,
            timeoutApplications,
            totalCompletedStages,
            delayedStages,
            slaOnTimeRate,
            totalCompletedStagesPa1,
            delayedStagesPa1,
            slaOnTimeRatePa1,
            highRiskLoans,
        };
    }
    async getSlaBottleneckAnalysis() {
        const stages = await this.prisma.workflowStage.findMany({
            orderBy: { orderIndex: 'asc' },
        });
        const analysis = await Promise.all(stages.map(async (st) => {
            let histories = await this.prisma.applicationStageHistory.findMany({
                where: {
                    stageId: st.id,
                    exitedAt: { not: null },
                },
                select: {
                    actualDurationHours: true,
                    netWorkDurationHours: true,
                    isDelayed: true,
                    slaPolicy: true,
                },
            });
            const summarize = (rows) => {
                const handled = rows.length;
                const delayed = rows.filter(h => h.isDelayed).length;
                const rate = handled > 0 ? Math.round((delayed / handled) * 1000) / 10 : 0;
                const avg = handled > 0 ? Math.round((rows.reduce((acc, h) => acc + (h.netWorkDurationHours || 0), 0) / handled) * 10) / 10 : 0;
                return { totalHandled: handled, delayedCount: delayed, delayRate: rate, avgNetWorkHours: avg, isBottleneck: rate >= 15 || avg > st.standardSlaHours };
            };
            const pa1 = summarize(histories.filter(h => h.slaPolicy === sla_policy_1.SLA_POLICY_PA1));
            histories = histories.filter(h => h.slaPolicy !== sla_policy_1.SLA_POLICY_PA1);
            const totalHandled = histories.length;
            const delayedCount = histories.filter((h) => h.isDelayed).length;
            const delayRate = totalHandled > 0 ? Math.round((delayedCount / totalHandled) * 1000) / 10 : 0;
            let avgNetWorkHours = 0;
            if (totalHandled > 0) {
                const sumNet = histories.reduce((acc, h) => acc + (h.netWorkDurationHours || 0), 0);
                avgNetWorkHours = Math.round((sumNet / totalHandled) * 10) / 10;
            }
            return {
                stageCode: st.stageCode,
                stageName: st.stageName,
                standardSlaHours: st.standardSlaHours,
                totalHandled,
                delayedCount,
                delayRate,
                avgNetWorkHours,
                isBottleneck: delayRate >= 15 || avgNetWorkHours > st.standardSlaHours,
                pa1,
            };
        }));
        return analysis;
    }
    async getOverdueSupplements(now = new Date()) {
        const rows = await this.prisma.supplementRequest.findMany({
            where: {
                status: 'PENDING',
                overdueAt: { not: null },
                application: { currentStatus: client_1.LoanStatus.SUPPLEMENT_REQUIRED },
            },
            select: {
                id: true, applicationId: true, requestedAt: true, deadlineAt: true, overdueAt: true, portalSupplement: true,
                application: {
                    select: {
                        applicationCode: true, assignedTo: true,
                        companySnapshot: true,
                        company: { select: { companyName: true } },
                        assignedUser: { select: { fullName: true } },
                    },
                },
            },
            orderBy: { overdueAt: 'asc' },
        });
        return rows.map((row) => ({
            id: row.id,
            applicationId: row.applicationId,
            applicationCode: row.application.applicationCode,
            companyName: (0, company_snapshot_1.companyForLoan)(row.application).companyName,
            assignedOfficer: row.application.assignedUser ? row.application.assignedUser.fullName : 'Chưa phân công',
            assignedOfficerId: row.application.assignedTo,
            requestedAt: row.requestedAt,
            deadlineAt: row.deadlineAt,
            overdueAt: row.overdueAt,
            waitingOn: (0, portal_supplement_1.waitingOn)(row),
            daysOverdue: Math.max(0, Math.floor((now.getTime() - (0, supplement_deadlines_1.overdueAt)(row.requestedAt, row.deadlineAt).getTime()) / 86_400_000)),
        }));
    }
    async getEarlyWarningList(user) {
        const activeStatuses = [
            client_1.LoanStatus.RECEIVED,
            client_1.LoanStatus.CHECKED,
            client_1.LoanStatus.SUPPLEMENT_REQUIRED,
            client_1.LoanStatus.PENDING_APPRAISAL,
        ];
        const activeLoans = await this.prisma.loanApplication.findMany({
            where: {
                currentStatus: { in: activeStatuses },
                ...(user?.activeRole === 'THAM_QUYEN' ? { currentStage: { not: client_1.StageCode.TIEP_NHAN } } : {}),
            },
            include: {
                company: true,
                assignedUser: { select: { id: true, fullName: true, username: true } },
                delayPredictions: {
                    orderBy: { predictionTimestamp: 'desc' },
                    take: 1,
                },
            },
        });
        const policies = await (0, prediction_status_1.firstStagePolicies)(this.prisma, activeLoans.map(loan => loan.id));
        const warnings = activeLoans.map((loan) => {
            const latestPred = loan.delayPredictions[0] || null;
            let topReasons = [];
            if (latestPred?.topReasonsJson) {
                try {
                    topReasons = JSON.parse(latestPred.topReasonsJson);
                }
                catch {
                    topReasons = [latestPred.topReasonsJson];
                }
            }
            return {
                id: loan.id,
                applicationCode: loan.applicationCode,
                companyName: (0, company_snapshot_1.companyForLoan)(loan).companyName,
                industry: (0, company_snapshot_1.companyForLoan)(loan).industry,
                loanAmount: Number(loan.officialAmount || loan.proposedAmount),
                currentStage: loan.currentStage,
                currentStatus: loan.currentStatus,
                supplementCount: loan.supplementCount,
                assignedOfficer: loan.assignedUser ? loan.assignedUser.fullName : 'Chưa phân công',
                assignedOfficerId: loan.assignedTo,
                riskLevel: latestPred ? latestPred.riskLevel : null,
                delayProbability: latestPred ? latestPred.delayProbability : null,
                predictionStatus: (0, prediction_status_1.predictionStatusOf)(!!latestPred, policies.get(loan.id)),
                predictedAt: latestPred ? latestPred.predictionTimestamp : null,
                topReasons,
            };
        });
        return warnings.sort((a, b) => (b.delayProbability ?? -1) - (a.delayProbability ?? -1));
    }
    async getStageDistribution() {
        const stages = [client_1.StageCode.TIEP_NHAN, client_1.StageCode.THAM_DINH, client_1.StageCode.HOAN_TAT];
        const distribution = await Promise.all(stages.map(async (st) => {
            const count = await this.prisma.loanApplication.count({
                where: { currentStage: st },
            });
            return {
                stage: st,
                count,
            };
        }));
        return distribution;
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map