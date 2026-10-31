import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { LoanStatus, StageCode, RiskLevel } from '@prisma/client';
import { waitingOn } from '../supplements/portal-supplement';
import { firstStagePolicies, predictionStatusOf } from '../prediction/prediction-status';
import { SLA_POLICY_PA1 } from '../workflow/sla/sla-policy';
import { overdueAt as supplementDueAt } from '../supplements/supplement-deadlines';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * UC17: Thống kê tổng quan KPI và SLA toàn chi nhánh
   */
  async getOverviewStats() {
    const activeStatuses: LoanStatus[] = [
      LoanStatus.RECEIVED,
      LoanStatus.CHECKED,
      LoanStatus.SUPPLEMENT_REQUIRED,
      LoanStatus.PENDING_APPRAISAL,
      LoanStatus.WAITING_HEAD_OFFICE,
    ];

    const [
      totalApplications,
      activeApplications,
      approvedApplications,
      rejectedApplications,
      timeoutApplications,
      totalCompletedStages,
      delayedStages,
      highRiskLoans,
      totalCompletedStagesPa1,
      delayedStagesPa1,
    ] = await Promise.all([
      this.prisma.loanApplication.count(),
      this.prisma.loanApplication.count({ where: { currentStatus: { in: activeStatuses } } }),
      this.prisma.loanApplication.count({ where: { currentStatus: LoanStatus.APPROVED } }),
      this.prisma.loanApplication.count({ where: { currentStatus: LoanStatus.REJECTED } }),
      this.prisma.loanApplication.count({ where: { currentStatus: LoanStatus.CLOSED_TIMEOUT } }),
      // Cách tính cũ (giờ thực 24/7) và PA1 (giờ làm việc) khác thước đo nên không cộng chung.
      this.prisma.applicationStageHistory.count({ where: { exitedAt: { not: null }, slaPolicy: null } }),
      this.prisma.applicationStageHistory.count({ where: { exitedAt: { not: null }, slaPolicy: null, isDelayed: true } }),
      // Số hồ sơ active có dự báo nguy cơ trễ cao
      this.prisma.loanApplication.count({
        where: {
          currentStatus: { in: activeStatuses },
          delayPredictions: {
            some: { riskLevel: RiskLevel.CAO },
          },
        },
      }),
      this.prisma.applicationStageHistory.count({ where: { exitedAt: { not: null }, slaPolicy: SLA_POLICY_PA1 } }),
      this.prisma.applicationStageHistory.count({ where: { exitedAt: { not: null }, slaPolicy: SLA_POLICY_PA1, isDelayed: true } }),
    ]);

    // Tỷ lệ đúng hạn SLA các công đoạn (%)
    const slaOnTimeRate =
      totalCompletedStages > 0
        ? Math.round(((totalCompletedStages - delayedStages) / totalCompletedStages) * 1000) / 10
        : 100;

    const slaOnTimeRatePa1 =
      totalCompletedStagesPa1 > 0
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
      slaOnTimeRate, // e.g. 88.5% (cách tính cũ, giờ thực)
      // Số liệu theo giờ làm việc (PA1), tách riêng; null khi chưa có công đoạn PA1 nào kết thúc.
      totalCompletedStagesPa1,
      delayedStagesPa1,
      slaOnTimeRatePa1,
      highRiskLoans, // Số hồ sơ cảnh báo đỏ AI
    };
  }

  /**
   * UC17: Phân tích điểm nghẽn SLA theo từng công đoạn (Bottleneck Analysis)
   */
  async getSlaBottleneckAnalysis() {
    const stages = await this.prisma.workflowStage.findMany({
      orderBy: { orderIndex: 'asc' },
    });

    const analysis = await Promise.all(
      stages.map(async (st) => {
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
        const summarize = (rows: typeof histories) => {
          const handled = rows.length;
          const delayed = rows.filter(h => h.isDelayed).length;
          const rate = handled > 0 ? Math.round((delayed / handled) * 1000) / 10 : 0;
          const avg = handled > 0 ? Math.round((rows.reduce((acc, h) => acc + (h.netWorkDurationHours || 0), 0) / handled) * 10) / 10 : 0;
          return { totalHandled: handled, delayedCount: delayed, delayRate: rate, avgNetWorkHours: avg, isBottleneck: rate >= 15 || avg > st.standardSlaHours };
        };
        const pa1 = summarize(histories.filter(h => h.slaPolicy === SLA_POLICY_PA1));
        histories = histories.filter(h => h.slaPolicy !== SLA_POLICY_PA1);

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
          delayRate, // Tỷ lệ trễ %
          avgNetWorkHours, // Thời gian trung bình ngân hàng trực tiếp xử lý
          isBottleneck: delayRate >= 15 || avgNetWorkHours > st.standardSlaHours,
          // Cùng các chỉ số nhưng theo giờ làm việc (PA1); các trường phía trên là cách tính cũ (giờ thực).
          pa1,
        };
      }),
    );

    return analysis;
  }

  /**
   * DEC-02: yêu cầu bổ sung đã quá hạn (ngày 10 hoặc hạn CBTD nhập) mà doanh nghiệp chưa bổ sung.
   * Chỉ liệt kê để Quản lý xem xét; không đổi trạng thái hồ sơ.
   */
  async getOverdueSupplements(now: Date = new Date()) {
    const rows = await this.prisma.supplementRequest.findMany({
      where: {
        status: 'PENDING',
        overdueAt: { not: null },
        application: { currentStatus: LoanStatus.SUPPLEMENT_REQUIRED },
      },
      select: {
        id: true, applicationId: true, requestedAt: true, deadlineAt: true, overdueAt: true, portalSupplement: true,
        application: {
          select: {
            applicationCode: true, assignedTo: true,
            company: { select: { companyName: true } },
            assignedUser: { select: { fullName: true } },
          },
        },
      },
      orderBy: { overdueAt: 'asc' },
    });
    return rows.map((row: any) => ({
      id: row.id,
      applicationId: row.applicationId,
      applicationCode: row.application.applicationCode,
      companyName: row.application.company.companyName,
      assignedOfficer: row.application.assignedUser ? row.application.assignedUser.fullName : 'Chưa phân công',
      assignedOfficerId: row.application.assignedTo,
      requestedAt: row.requestedAt,
      deadlineAt: row.deadlineAt,
      overdueAt: row.overdueAt,
      waitingOn: waitingOn(row),
      // Tính từ hạn thực tế (ngày 10 hoặc deadlineAt), không phải lúc bộ quét đánh dấu.
      daysOverdue: Math.max(0, Math.floor((now.getTime() - supplementDueAt(row.requestedAt, row.deadlineAt).getTime()) / 86_400_000)),
    }));
  }

  /**
   * UC18: Danh sách cảnh báo hồ sơ có nguy cơ chậm trễ (AI Early Warning)
   */
  async getEarlyWarningList(user?: { activeRole?: string }) {
    const activeStatuses: LoanStatus[] = [
      LoanStatus.RECEIVED,
      LoanStatus.CHECKED,
      LoanStatus.SUPPLEMENT_REQUIRED,
      LoanStatus.PENDING_APPRAISAL,
      LoanStatus.WAITING_HEAD_OFFICE,
    ];

    const activeLoans = await this.prisma.loanApplication.findMany({
      where: {
        currentStatus: { in: activeStatuses },
        // Thẩm quyền chỉ thấy hồ sơ từ công đoạn Thẩm định trở đi.
        ...(user?.activeRole === 'THAM_QUYEN' ? { currentStage: { not: StageCode.TIEP_NHAN } } : {}),
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

    const policies = await firstStagePolicies(this.prisma, activeLoans.map(loan => loan.id));
    const warnings = activeLoans.map((loan) => {
      const latestPred = loan.delayPredictions[0] || null;
      let topReasons: string[] = [];
      if (latestPred?.topReasonsJson) {
        try {
          topReasons = JSON.parse(latestPred.topReasonsJson);
        } catch {
          topReasons = [latestPred.topReasonsJson];
        }
      }

      return {
        id: loan.id,
        applicationCode: loan.applicationCode,
        companyName: loan.company.companyName,
        industry: loan.company.industry,
        loanAmount: Number(loan.officialAmount || loan.proposedAmount),
        currentStage: loan.currentStage,
        currentStatus: loan.currentStatus,
        supplementCount: loan.supplementCount,
        assignedOfficer: loan.assignedUser ? loan.assignedUser.fullName : 'Chưa phân công',
        assignedOfficerId: loan.assignedTo,
        // Không có dự báo thì để trống và nêu tình trạng, không bịa mức/xác suất.
        riskLevel: latestPred ? latestPred.riskLevel : null,
        delayProbability: latestPred ? latestPred.delayProbability : null,
        predictionStatus: predictionStatusOf(!!latestPred, policies.get(loan.id)),
        predictedAt: latestPred ? latestPred.predictionTimestamp : null,
        topReasons,
      };
    });

    // Sắp xếp: Xác suất trễ giảm dần (nguy cơ cao nhất lên đầu)
    return warnings.sort((a, b) => (b.delayProbability ?? -1) - (a.delayProbability ?? -1));
  }

  /**
   * Phân bổ hồ sơ theo từng công đoạn và trạng thái
   */
  async getStageDistribution() {
    const stages = [StageCode.TIEP_NHAN, StageCode.THAM_DINH, StageCode.CAP_TREN, StageCode.HOAN_TAT];
    
    const distribution = await Promise.all(
      stages.map(async (st) => {
        const count = await this.prisma.loanApplication.count({
          where: { currentStage: st },
        });
        return {
          stage: st,
          count,
        };
      }),
    );

    return distribution;
  }
}
