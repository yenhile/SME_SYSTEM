import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SLA_POLICY_PA1, calendarByVersion, loadPauseIntervals } from '../workflow/sla/sla-policy';
import { CalendarCoverageError, workingHoursBetween } from '../workflow/sla/working-time';
import { companyForLoan } from '../companies/company-snapshot';
import { PredictionStage, buildPredictPayload, riskLevelOf } from './prediction-features';
import { PREDICTION_UNAVAILABLE_MESSAGES, PredictionUnavailableReason } from './prediction-status';

const ACTIVE_STATUSES = ['RECEIVED', 'CHECKED', 'SUPPLEMENT_REQUIRED', 'PENDING_APPRAISAL'] as const;

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);
  private readonly mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

  constructor(private prisma: PrismaService) {}

  private unavailable(reason: PredictionUnavailableReason) {
    return { unavailable: true as const, reason, message: PREDICTION_UNAVAILABLE_MESSAGES[reason] };
  }

  /**
   * Dự báo nguy cơ vượt SLA của công đoạn đang mở (Tiếp nhận hoặc Thẩm định), theo giờ làm việc đã dùng và SLA đang áp dụng.
   * Chỉ dự báo khi công đoạn tính theo PA1: mô hình học trên giờ làm việc, không dùng cho cách tính 24/7 cũ.
   */
  async predictForApplication(applicationId: string) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: applicationId },
      include: {
        company: true,
        portalRequest: { select: { data: true } },
        appraisalReport: { select: { id: true, status: true } },
        supplementRequests: { orderBy: { requestedAt: 'desc' }, take: 1 },
        stageHistories: { include: { stage: true }, orderBy: { enteredAt: 'desc' } },
      },
    });
    if (!loan) throw new Error(`Không tìm thấy hồ sơ với id: ${applicationId}`);
    loan.company = companyForLoan(loan);

    const open = loan.stageHistories.find(h => !h.exitedAt);
    if (!open) return this.unavailable(loan.completedAt || loan.currentStage === 'HOAN_TAT' ? 'NO_ACTIVE_STAGE' : 'NO_STAGE_HISTORY');
    const stage = open.stage.stageCode as string;
    if (stage !== 'TIEP_NHAN' && stage !== 'THAM_DINH') return this.unavailable('STAGE_NOT_SUPPORTED');
    if (open.slaPolicy !== SLA_POLICY_PA1 || !open.slaCalendarVersion) return this.unavailable('LEGACY_SLA');

    const now = new Date();
    let elapsedHours: number;
    let sinceLastEvent: number;
    try {
      const calendar = calendarByVersion(open.slaCalendarVersion);
      const pauses = await loadPauseIntervals(this.prisma, open.id, open.slaPolicy);
      elapsedHours = workingHoursBetween(open.enteredAt, now, calendar, pauses);
      const lastEvent = await this.lastEventAt(loan, open, stage);
      sinceLastEvent = workingHoursBetween(lastEvent, now, calendar, pauses);
    } catch (err) {
      if (err instanceof CalendarCoverageError) return this.unavailable('CALENDAR_OUT_OF_RANGE');
      throw err;
    }

    const input = await this.collectInputs(loan, stage as PredictionStage);
    const payload = buildPredictPayload({
      ...input, stage: stage as PredictionStage, applicationCode: loan.applicationCode, slaHours: open.slaStandardHours,
      elapsedHours, hoursSinceLastEvent: sinceLastEvent, industry: loan.company.industry,
    });

    try {
      this.logger.log(`Gửi yêu cầu dự báo (${stage}) sang ML Service: ${this.mlServiceUrl}/predict`);
      const response = await fetch(`${this.mlServiceUrl}/predict`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.ML_API_KEY ? { 'X-API-Key': process.env.ML_API_KEY } : {}) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(4000),
      });
      if (response.status === 422) return this.unavailable('SLA_OUT_OF_RANGE');
      if (!response.ok) throw new Error(`ML Service trả về mã lỗi: ${response.status}`);
      const result = await response.json();

      const prediction = await this.prisma.delayPrediction.create({
        data: {
          applicationId: loan.id, riskLevel: riskLevelOf(result.alert_level), delayProbability: result.delay_probability,
          topReasonsJson: JSON.stringify(result.top_reasons || []), modelVersion: `${result.model_version || 'v4'}-${stage}`,
        },
      });
      return { ...prediction, topReasons: result.top_reasons || [], alertLevel: result.alert_level as string, stage, remainingHours: result.remaining_hours as number };
    } catch (err: any) {
      this.logger.warn(`Dịch vụ dự báo không khả dụng (hồ sơ ${loan.applicationCode}, ${stage}): ${err.message}`);
      throw new ServiceUnavailableException('Không lấy được dự báo từ dịch vụ ML. Vui lòng thử lại sau.');
    }
  }

  /** Thời điểm thao tác gần nhất trong công đoạn: vào công đoạn, yêu cầu/hoàn tất bổ sung, hoặc sự kiện tờ trình khi thẩm định. */
  private async lastEventAt(loan: any, open: any, stage: string): Promise<Date> {
    const enteredAt = open.enteredAt.getTime();
    const times: number[] = [enteredAt];
    const supp = loan.supplementRequests?.[0];
    if (supp) times.push(...[supp.requestedAt, supp.resolvedAt].filter(Boolean).map((d: Date) => d.getTime()));
    if (stage === 'THAM_DINH' && loan.appraisalReport) {
      const ev = await this.prisma.appraisalReportEvent.findFirst({ where: { reportId: loan.appraisalReport.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
      if (ev) times.push(ev.createdAt.getTime());
    }
    const latest = Math.max(...times.filter(t => t >= enteredAt));
    return new Date(Math.min(Date.now(), latest));
  }

  private async collectInputs(loan: any, stage: PredictionStage) {
    const base = {
      proposedAmountVnd: Number(loan.officialAmount || loan.proposedAmount), loanTermMonths: loan.loanTermMonths,
      establishedYear: loan.company.establishedYear, annualRevenueVnd: Number(loan.company.annualRevenue),
      portalData: (loan.portalRequest?.data ?? null) as any, supplementCount: loan.supplementCount,
      itemsPendingReview: 0, officerWorkload: 7, tnBankHours: 0, appraisalQueueLen: 0, appraisersActive: 1, clarifyRoundsSoFar: 0, clarifyOpen: false,
    };
    if (stage === 'TIEP_NHAN') {
      const lastSupp = loan.supplementRequests?.[0];
      // Doanh nghiệp vừa bổ sung xong và hồ sơ chưa được kiểm tra lại: xấp xỉ "có tài liệu bổ sung chờ kiểm tra" (hệ thống chưa lưu số tài liệu).
      base.itemsPendingReview = lastSupp?.resolvedAt && loan.currentStatus === 'RECEIVED' ? 1 : 0;
      base.officerWorkload = loan.assignedTo
        ? Math.max(1, await this.prisma.loanApplication.count({ where: { assignedTo: loan.assignedTo, currentStatus: { in: [...ACTIVE_STATUSES] } } }))
        : 7;
      return base;
    }
    const tn = loan.stageHistories.find((h: any) => h.stage.stageCode === 'TIEP_NHAN' && h.exitedAt);
    base.tnBankHours = tn?.netWorkDurationHours ?? 0;
    base.appraisalQueueLen = await this.prisma.loanApplication.count({ where: { currentStage: 'THAM_DINH', currentStatus: { in: [...ACTIVE_STATUSES] } } });
    // Số Thẩm quyền làm việc thật: tài khoản đang mở, chuyên trách Thẩm quyền; loại tài khoản kiểm thử test_* và tài khoản kiêm CBTD để dự báo không đổi theo số tài khoản demo.
    base.appraisersActive = Math.max(1, await this.prisma.user.count({
      where: {
        isActive: true,
        NOT: { username: { startsWith: 'test_' } },
        AND: [{ roles: { some: { role: { code: 'THAM_QUYEN' } } } }, { roles: { none: { role: { code: 'CBTD' } } } }],
      },
    }));
    if (loan.appraisalReport) {
      base.clarifyOpen = loan.appraisalReport.status === 'CLARIFICATION_REQUIRED';
      base.clarifyRoundsSoFar = await this.prisma.appraisalReportEvent.count({ where: { reportId: loan.appraisalReport.id, kind: 'CLARIFICATION_REQUESTED' } });
    }
    return base;
  }
}
