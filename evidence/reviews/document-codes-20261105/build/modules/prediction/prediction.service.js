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
var PredictionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma.service");
const client_1 = require("@prisma/client");
const sla_policy_1 = require("../workflow/sla/sla-policy");
const prediction_status_1 = require("./prediction-status");
const company_snapshot_1 = require("../companies/company-snapshot");
let PredictionService = PredictionService_1 = class PredictionService {
    prisma;
    logger = new common_1.Logger(PredictionService_1.name);
    mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    constructor(prisma) {
        this.prisma = prisma;
    }
    async predictForApplication(applicationId) {
        const loan = await this.prisma.loanApplication.findUnique({
            where: { id: applicationId },
            include: {
                company: true,
                assignedUser: true,
                stageHistories: {
                    orderBy: { enteredAt: 'desc' },
                },
            },
        });
        if (!loan) {
            throw new Error(`Không tìm thấy hồ sơ với id: ${applicationId}`);
        }
        loan.company = (0, company_snapshot_1.companyForLoan)(loan);
        const firstStageOfLoan = loan.stageHistories[loan.stageHistories.length - 1];
        if (firstStageOfLoan?.slaPolicy === sla_policy_1.SLA_POLICY_PA1) {
            this.logger.log(`Bỏ qua dự báo cho hồ sơ ${loan.applicationCode}: công đoạn Tiếp nhận tính theo PA1, chưa có mô hình tương thích.`);
            return { unavailable: true, reason: 'PA1_INCOMPATIBLE', message: prediction_status_1.PREDICTION_PA1_MESSAGE };
        }
        let officerWorkload = 5;
        if (loan.assignedTo) {
            const activeCount = await this.prisma.loanApplication.count({
                where: {
                    assignedTo: loan.assignedTo,
                    currentStatus: {
                        in: ['RECEIVED', 'CHECKED', 'SUPPLEMENT_REQUIRED', 'PENDING_APPRAISAL'],
                    },
                },
            });
            officerWorkload = Math.max(1, activeCount);
        }
        let previousDuration = 3.5;
        if (loan.stageHistories && loan.stageHistories.length > 0) {
            const firstStage = loan.stageHistories[loan.stageHistories.length - 1];
            if (firstStage.netWorkDurationHours) {
                previousDuration = firstStage.netWorkDurationHours;
            }
            else if (firstStage.enteredAt) {
                const hours = (Date.now() - new Date(firstStage.enteredAt).getTime()) / (1000 * 60 * 60);
                previousDuration = Math.round(hours * 10) / 10;
            }
        }
        let industryMapped = 'Thuong_Mai_Dich_Vu';
        const indLower = loan.company.industry.toLowerCase();
        if (indLower.includes('sản xuất') || indLower.includes('chế biến') || indLower.includes('may mặc')) {
            industryMapped = 'San_Xuat';
        }
        else if (indLower.includes('xây dựng') || indLower.includes('cơ khí')) {
            industryMapped = 'Xay_Dung';
        }
        else if (indLower.includes('nông nghiệp') || indLower.includes('thủy sản')) {
            industryMapped = 'Nong_Nghiep';
        }
        else if (indLower.includes('vận tải') || indLower.includes('kho bãi') || indLower.includes('logistics')) {
            industryMapped = 'Van_Tai_Kho_Bai';
        }
        const payload = {
            application_id: loan.applicationCode,
            loan_amount: Number(loan.officialAmount || loan.proposedAmount),
            loan_term_months: loan.loanTermMonths,
            loan_type: loan.loanType,
            industry: industryMapped,
            established_years: Math.max(1, new Date().getFullYear() - loan.company.establishedYear),
            annual_revenue: Number(loan.company.annualRevenue),
            debt_to_equity: Number(loan.company.annualRevenue) > 0 ? Number(loan.company.charterCapital) > 0 ? Number(loan.proposedAmount) / Number(loan.company.charterCapital) : 1.5 : 1.5,
            supplement_count: loan.supplementCount,
            officer_workload: officerWorkload,
            previous_stage_duration_hours: Math.min(12, Math.max(1, previousDuration)),
        };
        try {
            this.logger.log(`Gửi yêu cầu dự báo sang ML Service: ${this.mlServiceUrl}/predict`);
            const response = await fetch(`${this.mlServiceUrl}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(4000),
            });
            if (!response.ok) {
                throw new Error(`ML Service trả về mã lỗi: ${response.status}`);
            }
            const result = await response.json();
            let riskLevel = client_1.RiskLevel.THAP;
            if (result.risk_level === 'CAO')
                riskLevel = client_1.RiskLevel.CAO;
            else if (result.risk_level === 'TRUNG BÌNH')
                riskLevel = client_1.RiskLevel.TRUNG_BINH;
            const prediction = await this.prisma.delayPrediction.create({
                data: {
                    applicationId: loan.id,
                    riskLevel,
                    delayProbability: result.delay_probability,
                    topReasonsJson: JSON.stringify(result.top_reasons || []),
                    modelVersion: result.model_version || 'v1.0-rf',
                },
            });
            return {
                ...prediction,
                topReasons: result.top_reasons || [],
            };
        }
        catch (err) {
            this.logger.warn('Dịch vụ dự báo không khả dụng: ' + err.message);
            throw new common_1.ServiceUnavailableException('Không lấy được dự báo từ dịch vụ ML. Vui lòng thử lại sau.');
        }
    }
};
exports.PredictionService = PredictionService;
exports.PredictionService = PredictionService = PredictionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PredictionService);
//# sourceMappingURL=prediction.service.js.map