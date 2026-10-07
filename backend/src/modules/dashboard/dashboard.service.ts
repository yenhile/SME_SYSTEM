import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { LoanStatus, StageCode, RiskLevel } from '@prisma/client';

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
    ] = await Promise.all([
      this.prisma.loanApplication.count(),
      this.prisma.loanApplication.count({ where: { currentStatus: { in: activeStatuses } } }),
      this.prisma.loanApplication.count({ where: { currentStatus: LoanStatus.APPROVED } }),
      this.prisma.loanApplication.count({ where: { currentStatus: LoanStatus.REJECTED } }),
      this.prisma.loanApplication.count({ where: { currentStatus: LoanStatus.CLOSED_TIMEOUT } }),
      this.prisma.applicationStageHistory.count({ where: { exitedAt: { not: null } } }),
      this.prisma.applicationStageHistory.count({ where: { exitedAt: { not: null }, isDelayed: true } }),
      // Số hồ sơ active có dự báo nguy cơ trễ cao
      this.prisma.loanApplication.count({
        where: {
          currentStatus: { in: activeStatuses },
          delayPredictions: {
            some: { riskLevel: RiskLevel.CAO },
          },
        },
      }),
    ]);

    // Tỷ lệ đúng hạn SLA các công đoạn (%)
    const slaOnTimeRate =
      totalCompletedStages > 0
        ? Math.round(((totalCompletedStages - delayedStages) / totalCompletedStages) * 1000) / 10
        : 100;

    return {
      totalApplications,
      activeApplications,
      approvedApplications,
      rejectedApplications,
      timeoutApplications,
      totalCompletedStages,
      delayedStages,
      slaOnTimeRate, // e.g. 88.5%
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
        const histories = await this.prisma.applicationStageHistory.findMany({
          where: {
            stageId: st.id,
            exitedAt: { not: null },
          },
          select: {
            actualDurationHours: true,
            netWorkDurationHours: true,
            isDelayed: true,
          },
        });

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
        };
      }),
    );

    return analysis;
  }

  /**
   * UC18: Danh sách cảnh báo hồ sơ có nguy cơ chậm trễ (AI Early Warning)
   */
  async getEarlyWarningList() {
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
        riskLevel: latestPred ? latestPred.riskLevel : RiskLevel.THAP,
        delayProbability: latestPred ? latestPred.delayProbability : 0.05,
        predictedAt: latestPred ? latestPred.predictionTimestamp : null,
        topReasons,
      };
    });

    // Sắp xếp: Xác suất trễ giảm dần (nguy cơ cao nhất lên đầu)
    return warnings.sort((a, b) => b.delayProbability - a.delayProbability);
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
