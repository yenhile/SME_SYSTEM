import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RiskLevel } from '@prisma/client';

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);
  private readonly mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

  constructor(private prisma: PrismaService) {}

  async predictForApplication(applicationId: string) {
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

    // 1. Tính toán officer_workload (Số hồ sơ đang xử lý của cán bộ)
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

    // 2. Tính previous_stage_duration_hours
    let previousDuration = 3.5;
    if (loan.stageHistories && loan.stageHistories.length > 0) {
      const firstStage = loan.stageHistories[loan.stageHistories.length - 1];
      if (firstStage.netWorkDurationHours) {
        previousDuration = firstStage.netWorkDurationHours;
      } else if (firstStage.enteredAt) {
        const hours = (Date.now() - new Date(firstStage.enteredAt).getTime()) / (1000 * 60 * 60);
        previousDuration = Math.round(hours * 10) / 10;
      }
    }

    // 3. Chuẩn hóa industry sang định dạng ML
    let industryMapped = 'Thuong_Mai_Dich_Vu';
    const indLower = loan.company.industry.toLowerCase();
    if (indLower.includes('sản xuất') || indLower.includes('chế biến') || indLower.includes('may mặc')) {
      industryMapped = 'San_Xuat';
    } else if (indLower.includes('xây dựng') || indLower.includes('cơ khí')) {
      industryMapped = 'Xay_Dung';
    } else if (indLower.includes('nông nghiệp') || indLower.includes('thủy sản')) {
      industryMapped = 'Nong_Nghiep';
    } else if (indLower.includes('vận tải') || indLower.includes('kho bãi') || indLower.includes('logistics')) {
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

      let riskLevel: RiskLevel = RiskLevel.THAP;
      if (result.risk_level === 'CAO') riskLevel = RiskLevel.CAO;
      else if (result.risk_level === 'TRUNG BÌNH') riskLevel = RiskLevel.TRUNG_BINH;

      // Lưu kết quả vào Database
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
    } catch (err: any) {
      this.logger.warn(`Không thể kết nối ML Service (${err.message}). Dùng heuristic dự báo cục bộ.`);
      // Heuristic fallback nếu ML service offline
      const isHighRisk = loan.supplementCount >= 2 || officerWorkload >= 10;
      const prob = isHighRisk ? 0.78 : loan.supplementCount === 1 ? 0.45 : 0.08;
      const riskLevel = isHighRisk ? RiskLevel.CAO : loan.supplementCount === 1 ? RiskLevel.TRUNG_BINH : RiskLevel.THAP;
      
      const reasons: string[] = [];
      if (loan.supplementCount >= 2) {
        reasons.push(`Hồ sơ đã yêu cầu bổ sung ${loan.supplementCount} lần (+35% nguy cơ)`);
      } else if (loan.supplementCount === 1) {
        reasons.push('Hồ sơ đã có 1 lần yêu cầu bổ sung tài liệu');
      }
      if (officerWorkload >= 10) {
        reasons.push(`Cán bộ đang quá tải phụ trách ${officerWorkload} hồ sơ`);
      }
      if (reasons.length === 0) {
        reasons.push('Hồ sơ đảm bảo quy chuẩn xử lý đúng hạn.');
      }

      return this.prisma.delayPrediction.create({
        data: {
          applicationId: loan.id,
          riskLevel,
          delayProbability: prob,
          topReasonsJson: JSON.stringify(reasons),
          modelVersion: 'v1.0-fallback',
        },
      });
    }
  }
}
