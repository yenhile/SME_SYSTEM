import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { LoanStatus, StageCode, RiskLevel } from '@prisma/client';
import { waitingOn } from '../supplements/portal-supplement';
import { currentStagePrediction, predictionStatusOf } from '../prediction/prediction-status';
import { SLA_POLICY_PA1, stageSlaSummary } from '../workflow/sla/sla-policy';
import { buildPeriodReport, parseReportRange } from './dashboard-report';
import { overdueAt as supplementDueAt } from '../supplements/supplement-deadlines';
import {companyForLoan} from '../companies/company-snapshot';
import { isEvidenceChanged } from '../appraisal/appraisal.logic';
import { isOfficerTurn, needsEvidenceCheck, OFFICER_TURN_SELECT, officerTask } from '../loan-applications/officer-turn';
import { LoanApplicationsService } from '../loan-applications/loan-applications.service';
import {
  ACTIVE_STATUSES, mlLevelOf, officerChoices, operationsScope, parseOperationsQuery, slaStateOf, summarizeOperations, comparePriority,
  countSla, officerLoad, recentMonths, monthsStart, vnMonthKey,
  type MyTurnStatus, type OperationsQuery, type OperationsRow,
} from './dashboard-operations';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService, @Optional() private loans?: LoanApplicationsService) {}

  /**
   * Dashboard vận hành: số liệu tồn đọng tại `now` của hồ sơ đang xử lý trong phạm vi vai trò đang dùng.
   * Bộ lọc công đoạn và cán bộ áp dụng cho mọi số liệu, trừ "chờ tôi xử lý" là hàng việc cá nhân.
   */
  async getOperations(user: { id: string; activeRole?: string; roles?: string[] }, query: OperationsQuery = {}, now: Date = new Date()) {
    const scope = operationsScope(user?.activeRole);
    const filters = parseOperationsQuery(query, scope);
    const loans = await this.prisma.loanApplication.findMany({
      where: {
        completedAt: null,
        currentStatus: { in: ACTIVE_STATUSES },
        currentStage: { in: filters.stage ? [filters.stage] : scope },
      },
      select: {
        id: true, applicationCode: true, companySnapshot: true, currentStage: true, currentStatus: true, assignedTo: true,
        company: { select: { companyName: true } },
        assignedUser: { select: { id: true, fullName: true } },
        delayPredictions: { orderBy: { predictionTimestamp: 'desc' }, take: 1 },
        stageHistories: { where: { exitedAt: null }, include: { pauses: true }, take: 1 },
      },
    });

    const inScope: OperationsRow[] = loans.map((loan: any) => this.openRow(loan, now));

    const rows = filters.officerId ? inScope.filter(row => row.assignedOfficerId === filters.officerId) : inScope;
    const summary = summarizeOperations(rows, filters.stage ? [filters.stage] : scope);
    const branchWide = user.activeRole === 'QUAN_LY' || user.activeRole === 'ADMIN';
    const ordered = [...rows].sort(comparePriority);
    const start = (filters.page - 1) * filters.pageSize;
    return {
      generatedAt: now,
      scope: { role: user.activeRole, stages: scope },
      filters: { stage: filters.stage, officerId: filters.officerId },
      kpis: { ...summary.kpis, myTurn: await this.myTurn(user) },
      stageDistribution: summary.stageDistribution,
      slaByStage: summary.slaByStage,
      sla: summary.sla,
      ml: summary.ml,
      officerLoad: officerLoad(rows),
      // Đề nghị Portal "Đã gửi, chờ phân công" chưa thành hồ sơ nên đếm riêng, không cộng vào số hồ sơ.
      unassigned: branchWide ? {
        loans: rows.filter(row => !row.assignedOfficerId).length,
        portalRequests: await this.prisma.portalRequest.count({ where: { status: 'SUBMITTED' } }),
      } : null,
      officers: officerChoices(inScope),
      priority: { items: ordered.slice(start, start + filters.pageSize), total: rows.length, page: filters.page, pageSize: filters.pageSize },
    };
  }

  /** Một dòng hồ sơ đang mở: tình trạng SLA tại `now` và dự báo hợp lệ của công đoạn đang mở. */
  private openRow(loan: any, now: Date): OperationsRow {
    const open = loan.stageHistories?.[0] ?? null;
    const sla = open ? stageSlaSummary(open, (open.pauses ?? []).map((p: any) => ({ start: p.startedAt, end: p.endedAt })), now) : null;
    const prediction = currentStagePrediction<{ modelVersion: string; predictionTimestamp: Date; riskLevel: string; delayProbability: number; topReasonsJson: string | null }>(loan.delayPredictions, loan.currentStage, open ?? undefined);
    let topReason: string | null = null;
    if (prediction?.topReasonsJson) {
      try { topReason = JSON.parse(prediction.topReasonsJson)[0] ?? null; } catch { topReason = prediction.topReasonsJson; }
    }
    const state = slaStateOf(sla);
    return {
      id: loan.id,
      applicationCode: loan.applicationCode,
      companyName: companyForLoan(loan).companyName,
      currentStage: loan.currentStage,
      currentStatus: loan.currentStatus,
      assignedOfficerId: loan.assignedTo ?? null,
      assignedOfficer: loan.assignedUser?.fullName ?? null,
      slaState: state,
      slaDueAt: state === 'PAUSED' ? null : sla?.dueAt ?? null,
      slaRemainingHours: state === 'ON_TIME' || state === 'DUE_SOON' ? sla!.remainingHours : null,
      mlLevel: mlLevelOf(prediction?.riskLevel),
      delayProbability: prediction ? prediction.delayProbability : null,
      predictedAt: prediction ? prediction.predictionTimestamp : null,
      topReason,
    };
  }

  /**
   * Dashboard cá nhân của CBTD: chỉ hồ sơ CBTD đang đăng nhập phụ trách. "Chờ tôi xử lý" dùng cùng quy tắc với khối Cần xử lý ngay
   * (`isOfficerTurn`), kèm việc cần làm tiếp theo.
   */
  async getOfficerDashboard(user: { id: string; activeRole?: string }, query: { page?: string; pageSize?: string } = {}, now: Date = new Date()) {
    if (user?.activeRole !== 'CBTD') throw new ForbiddenException('Dashboard này dành cho cán bộ tín dụng.');
    const paging = parseOperationsQuery({ page: query.page, pageSize: query.pageSize }, []);
    const loans: any[] = await this.prisma.loanApplication.findMany({
      where: { assignedTo: user.id },
      select: {
        ...OFFICER_TURN_SELECT, applicationCode: true,
        company: { select: { companyName: true } },
        delayPredictions: { orderBy: { predictionTimestamp: 'desc' }, take: 1 },
        stageHistories: { where: { exitedAt: null }, include: { pauses: true }, take: 1 },
      },
    });
    const active = loans.filter(loan => !loan.completedAt && ACTIVE_STATUSES.includes(loan.currentStatus));
    const changed = new Set<string>();
    for (const loan of active) {
      if (needsEvidenceCheck(loan) && await isEvidenceChanged(this.prisma, loan, loan.appraisalReport.versions[0].evidenceHash)) changed.add(loan.id);
    }
    const rows = active.map(loan => ({ ...this.openRow(loan, now), task: officerTask(loan, changed.has(loan.id)) }));
    const tasks = rows.filter(row => row.task).sort(comparePriority);
    const statusCounts = new Map<string, number>();
    for (const loan of loans) statusCounts.set(loan.currentStatus, (statusCounts.get(loan.currentStatus) ?? 0) + 1);
    const months = recentMonths(now);
    const completed = new Map(months.map(month => [month, 0]));
    for (const loan of loans) {
      const key = loan.completedAt ? vnMonthKey(loan.completedAt) : null;
      if (key && completed.has(key)) completed.set(key, completed.get(key)! + 1);
    }
    const start = (paging.page - 1) * paging.pageSize;
    return {
      generatedAt: now,
      kpis: {
        assigned: rows.length,
        myTurn: tasks.length,
        overdue: rows.filter(row => row.slaState === 'OVERDUE').length,
        mlFlagged: rows.filter(row => row.slaState !== 'OVERDUE' && (row.mlLevel === 'KHAN' || row.mlLevel === 'CHU_Y')).length,
      },
      sla: countSla(rows),
      statusDistribution: [...statusCounts].map(([status, count]) => ({ status, count })),
      completionTrend: months.map(month => ({ month, completed: completed.get(month)! })),
      tasks: { items: tasks.slice(start, start + paging.pageSize), total: tasks.length, page: paging.page, pageSize: paging.pageSize },
    };
  }

  /**
   * Dashboard của Thẩm quyền. Hàng chờ là nhóm "Chờ quyết định" của hàng việc thẩm định (đọc hết các trang); quyết định là công đoạn
   * Thẩm định đã đóng sang Phê duyệt hoặc Từ chối, tính chung cả hàng việc và riêng phần người đăng nhập.
   */
  async getApproverDashboard(user: { id: string; activeRole?: string; roles?: string[] }, now: Date = new Date()) {
    if (user?.activeRole !== 'THAM_QUYEN' || !this.loans) throw new ForbiddenException('Dashboard này dành cho cấp thẩm quyền.');
    const queue: any[] = [];
    for (let page = 1; ; page++) {
      const result: any = await this.loans.findAll(user, { queue: 'DECIDE', page: String(page), pageSize: '100' });
      queue.push(...result.items);
      if (!result.items.length || queue.length >= result.total) break;
    }
    const queueRows = queue.map(item => ({ item, slaState: slaStateOf(item.slaSummary ?? null) }));
    const byType = new Map<string, { count: number; hours: number; withHours: number }>();
    for (const { item } of queueRows) {
      const group = byType.get(item.loanType) ?? { count: 0, hours: 0, withHours: 0 };
      group.count += 1;
      const hours = item.slaSummary?.netWorkHours;
      if (typeof hours === 'number') { group.hours += hours; group.withHours += 1; }
      byType.set(item.loanType, group);
    }

    const months = recentMonths(now);
    const histories: any[] = await this.prisma.applicationStageHistory.findMany({
      where: { exitedAt: { gte: monthsStart(now), lte: now }, stage: { stageCode: StageCode.THAM_DINH }, application: { currentStatus: { in: [LoanStatus.APPROVED, LoanStatus.REJECTED] } } },
      select: { exitedAt: true, handledBy: true, application: { select: { currentStatus: true } } },
    });
    const decisions = histories.filter(h => h.application?.currentStatus === LoanStatus.APPROVED || h.application?.currentStatus === LoanStatus.REJECTED);
    const trend = new Map(months.map(month => [month, { approved: 0, rejected: 0 }]));
    for (const h of decisions) {
      const bucket = trend.get(vnMonthKey(h.exitedAt));
      if (!bucket) continue;
      if (h.application.currentStatus === LoanStatus.APPROVED) bucket.approved += 1; else bucket.rejected += 1;
    }
    const since = new Date(now.getTime() - 30 * 86_400_000);
    const recent = decisions.filter(h => h.exitedAt >= since);
    const queueSla = countSla(queueRows);
    return {
      generatedAt: now,
      kpis: { waiting: queue.length, overdue: queueSla.overdue, dueSoon: queueSla.dueSoon, decided: { days: 30, total: recent.length, mine: recent.filter(h => h.handledBy === user.id).length } },
      queueSla,
      waitByLoanType: [...byType].map(([loanType, g]) => ({ loanType, count: g.count, avgWorkHours: g.withHours ? Math.round((g.hours / g.withHours) * 10) / 10 : null })),
      decisionTrend: months.map(month => ({ month, ...trend.get(month)! })),
    };
  }

  /** Chỉ Thẩm quyền có quy tắc "chờ tôi" đã duyệt: nhóm Chờ quyết định của hàng việc thẩm định. Quản lý chưa có định nghĩa; Admin chỉ xem. */
  private async myTurn(user: { id: string; activeRole?: string; roles?: string[] }): Promise<{ status: MyTurnStatus; value: number | null }> {
    if (user.activeRole === 'THAM_QUYEN' && this.loans) {
      const queue: any = await this.loans.findAll(user, { queue: 'DECIDE', page: '1', pageSize: '1' });
      return { status: 'AVAILABLE', value: queue.total };
    }
    return { status: user.activeRole === 'QUAN_LY' ? 'PENDING_PO' : 'NOT_APPLICABLE', value: null };
  }

  /**
   * UC17: Thống kê tổng quan KPI và SLA toàn chi nhánh
   */
  async getOverviewStats() {
    const activeStatuses: LoanStatus[] = [
      LoanStatus.RECEIVED,
      LoanStatus.CHECKED,
      LoanStatus.SUPPLEMENT_REQUIRED,
      LoanStatus.PENDING_APPRAISAL,
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
      // Số hồ sơ đang xử lý mà dự báo MỚI NHẤT là nguy cơ cao (dự báo cũ đã được chấm lại thì không tính)
      this.prisma.loanApplication
        .findMany({
          where: { currentStatus: { in: activeStatuses } },
          select: {
            currentStage: true,
            delayPredictions: { select: { riskLevel: true, modelVersion: true, predictionTimestamp: true }, orderBy: { predictionTimestamp: 'desc' }, take: 1 },
            stageHistories: { where: { exitedAt: null }, select: { enteredAt: true }, take: 1 },
          },
        })
        .then(rows => rows.filter(row => currentStagePrediction(row.delayPredictions, row.currentStage, row.stageHistories[0])?.riskLevel === RiskLevel.CAO).length),
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
            companySnapshot: true,
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
      companyName: companyForLoan(row.application).companyName,
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
  /**
   * Báo cáo thống kê theo khoảng thời gian (Quản lý chi nhánh): hồ sơ tạo mới và hoàn tất, tỷ lệ duyệt, trễ SLA theo công đoạn,
   * theo cán bộ, theo loại vay và theo tháng. Mặc định 30 ngày gần nhất; tối đa 366 ngày.
   */
  async getPeriodReport(from?: string, to?: string, now = new Date()) {
    const range = parseReportRange(from, to, now);
    const loanSelect = { createdAt: true, completedAt: true, currentStatus: true, loanType: true, proposedAmount: true, approvedAmount: true, assignedTo: true } as const;
    const [created, completed, stageRows] = await Promise.all([
      this.prisma.loanApplication.findMany({ where: { createdAt: { gte: range.start, lt: range.end } }, select: loanSelect }),
      this.prisma.loanApplication.findMany({ where: { completedAt: { gte: range.start, lt: range.end } }, select: loanSelect }),
      this.prisma.applicationStageHistory.findMany({
        where: { exitedAt: { gte: range.start, lt: range.end }, slaPolicy: SLA_POLICY_PA1, stage: { stageCode: { in: [StageCode.TIEP_NHAN, StageCode.THAM_DINH] } } },
        select: { handledBy: true, netWorkDurationHours: true, isDelayed: true, stage: { select: { stageCode: true } } },
      }),
    ]);
    const stages = stageRows.map(row => ({ stageCode: row.stage.stageCode as string, handledBy: row.handledBy, netWorkDurationHours: row.netWorkDurationHours, isDelayed: row.isDelayed }));
    const ids = new Set<string>();
    for (const loan of [...created, ...completed]) if (loan.assignedTo) ids.add(loan.assignedTo);
    for (const stage of stages) if (stage.handledBy) ids.add(stage.handledBy);
    const users = ids.size ? await this.prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, fullName: true } }) : [];
    const officerNames = Object.fromEntries(users.map(user => [user.id, user.fullName]));
    return buildPeriodReport({ range, created, completed, stages, officerNames });
  }

  /**
   * Danh sách cảnh báo sớm theo xác suất trễ giảm dần. `onlyAssignedTo` giới hạn trong hồ sơ do một cán bộ phụ trách
   * (CBTD chỉ thấy hồ sơ của mình). `officerTurnOnly` chỉ giữ hồ sơ đang chờ chính CBTD xử lý, bỏ hồ sơ chờ doanh nghiệp
   * hoặc chờ Thẩm quyền. Kèm số giờ làm việc còn lại của công đoạn đang mở để người xử lý biết mức khẩn.
   */
  async getEarlyWarningList(user?: { activeRole?: string }, onlyAssignedTo?: string, options: { officerTurnOnly?: boolean } = {}) {
    const activeStatuses: LoanStatus[] = [
      LoanStatus.RECEIVED,
      LoanStatus.CHECKED,
      LoanStatus.SUPPLEMENT_REQUIRED,
      LoanStatus.PENDING_APPRAISAL,
    ];

    const activeLoans = await this.prisma.loanApplication.findMany({
      where: {
        currentStatus: { in: activeStatuses },
        // Thẩm quyền chỉ thấy hồ sơ từ công đoạn Thẩm định trở đi.
        ...(user?.activeRole === 'THAM_QUYEN' ? { currentStage: { not: StageCode.TIEP_NHAN } } : {}),
        ...(onlyAssignedTo ? { assignedTo: onlyAssignedTo } : {}),
      },
      include: {
        company: true,
        assignedUser: { select: { id: true, fullName: true, username: true } },
        delayPredictions: {
          orderBy: { predictionTimestamp: 'desc' },
          take: 1,
        },
        stageHistories: { where: { exitedAt: null }, include: { pauses: true }, take: 1 },
        ...(options.officerTurnOnly ? {
          supplementRequests: { where: { status: 'PENDING' }, select: { id: true } },
          coordinationRequests: { where: { status: 'PENDING', reasonCode: 'CONFLICT_OF_INTEREST' }, select: { id: true } },
          appraisalReport: { select: { status: true, versions: { orderBy: { sequence: 'desc' }, take: 1, select: { evidenceHash: true } } } },
        } : {}),
      },
    });
    const now = new Date();

    let loans = activeLoans;
    if (options.officerTurnOnly) {
      const changed = new Set<string>();
      for (const loan of activeLoans as any[]) {
        if (needsEvidenceCheck(loan) && await isEvidenceChanged(this.prisma, loan, loan.appraisalReport.versions[0].evidenceHash)) changed.add(loan.id);
      }
      loans = activeLoans.filter((loan: any) => isOfficerTurn(loan, changed.has(loan.id)));
    }

    const warnings = loans.map((loan) => {
      const latestPred = currentStagePrediction(loan.delayPredictions, loan.currentStage, loan.stageHistories?.[0]);
      let topReasons: string[] = [];
      if (latestPred?.topReasonsJson) {
        try {
          topReasons = JSON.parse(latestPred.topReasonsJson);
        } catch {
          topReasons = [latestPred.topReasonsJson];
        }
      }

      const open = loan.stageHistories?.[0];
      const sla = open ? stageSlaSummary(open, (open.pauses ?? []).map(p => ({ start: p.startedAt, end: p.endedAt })), now) : null;
      return {
        id: loan.id,
        applicationCode: loan.applicationCode,
        companyName: companyForLoan(loan).companyName,
        industry: companyForLoan(loan).industry,
        loanAmount: Number(loan.officialAmount || loan.proposedAmount),
        currentStage: loan.currentStage,
        currentStatus: loan.currentStatus,
        supplementCount: loan.supplementCount,
        assignedOfficer: loan.assignedUser ? loan.assignedUser.fullName : 'Chưa phân công',
        assignedOfficerId: loan.assignedTo,
        // Không có dự báo thì để trống và nêu tình trạng, không bịa mức/xác suất.
        riskLevel: latestPred ? latestPred.riskLevel : null,
        delayProbability: latestPred ? latestPred.delayProbability : null,
        predictionStatus: predictionStatusOf(!!latestPred),
        predictedAt: latestPred ? latestPred.predictionTimestamp : null,
        modelVersion: latestPred ? latestPred.modelVersion : null,
        slaRemainingHours: sla && !sla.waitingEnterprise ? sla.remainingHours : null,
        slaOverdue: Boolean(sla?.isOverdue),
        slaWaiting: Boolean(sla?.waitingEnterprise),
        topReasons,
      };
    });

    // Sắp xếp: Xác suất trễ giảm dần (nguy cơ cao nhất lên đầu)
    // Hồ sơ đã quá hạn SLA (tính theo thời gian thực) luôn lên đầu, sau đó theo xác suất giảm dần.
    return warnings.sort((a, b) => Number(b.slaOverdue) - Number(a.slaOverdue) || (b.delayProbability ?? -1) - (a.delayProbability ?? -1));
  }

  /**
   * Phân bổ hồ sơ theo từng công đoạn và trạng thái
   */
  async getStageDistribution() {
    const stages = [StageCode.TIEP_NHAN, StageCode.THAM_DINH, StageCode.HOAN_TAT];
    
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
