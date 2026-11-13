import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LoanType, StageCode } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { auditLogFilter, recordAdminActions, type AuditLogQuery } from './admin-audit';
import { bandView, loanTypeLabel, parseBandInput, selectActiveBand, type RateBandInput } from './modules/rate-bands/rate-band.logic';

type PredictionLimits = { slaRangeHours: Record<string, [number, number]> };

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private readonly prisma: PrismaService) {}

  stages() {
    return this.prisma.workflowStage.findMany({ orderBy: { orderIndex: 'asc' } });
  }

  /** Tên công đoạn là thuật ngữ nghiệp vụ dùng chung nên Admin chỉ được đổi định mức giờ. */
  async updateStageSla(code: StageCode, body: { standardSlaHours: number }, actorId: string) {
    if (code === StageCode.HOAN_TAT) throw new BadRequestException('Công đoạn Hoàn tất không tính SLA nên không có định mức để sửa.');
    return this.prisma.$transaction(async tx => {
      const current = await tx.workflowStage.findUnique({ where: { stageCode: code } });
      if (!current) throw new NotFoundException('Không tìm thấy công đoạn.');
      const updated = await tx.workflowStage.update({ where: { stageCode: code }, data: { standardSlaHours: body.standardSlaHours } });
      if (current.standardSlaHours !== body.standardSlaHours) {
        await recordAdminActions(tx, actorId, [{
          action: 'STAGE_SLA_UPDATED', targetType: 'WORKFLOW_STAGE', targetId: code, targetLabel: current.stageName,
          before: { standardSlaHours: current.standardSlaHours }, after: { standardSlaHours: body.standardSlaHours },
        }]);
      }
      return updated;
    });
  }

  /** Mọi phiên bản khung, mới nhất trước, kèm khung đang hiệu lực của từng loại vay. */
  async rateBands(now: Date = new Date()) {
    const rows = await this.prisma.interestRateBand.findMany({ orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }] });
    const active = Object.fromEntries(Object.values(LoanType).map(loanType => [loanType, bandView(selectActiveBand(rows, { loanType, termMonths: 1, at: now }))]));
    return { items: rows.map(row => ({ ...bandView(row)!, loanType: row.loanType, createdBy: row.createdBy, createdAt: row.createdAt })), active };
  }

  /** Khung chỉ thêm phiên bản mới, không sửa phiên bản cũ; nhật ký ghi kèm phiên bản mới nhất trước đó của cùng loại vay. */
  async createRateBand(input: RateBandInput, actorId: string, now: Date = new Date()) {
    const band = parseBandInput(input, now);
    return this.prisma.$transaction(async tx => {
      const previous = await tx.interestRateBand.findFirst({ where: { loanType: band.loanType }, orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }] });
      const created = await tx.interestRateBand.create({ data: { ...band, createdBy: actorId } });
      const values = (row: { minRate: unknown; maxRate: unknown; effectiveFrom: Date }) => ({ minRate: Number(row.minRate), maxRate: Number(row.maxRate), effectiveFrom: row.effectiveFrom.toISOString() });
      await recordAdminActions(tx, actorId, [{
        action: 'INTEREST_RATE_BAND_CREATED', targetType: 'INTEREST_RATE_BAND', targetId: created.id, targetLabel: loanTypeLabel(band.loanType),
        before: previous ? values(previous) : null, after: { ...values(created), basis: created.basis },
      }]);
      return created;
    });
  }

  async auditLogs(query: AuditLogQuery) {
    const { where, page, pageSize } = auditLogFilter(query);
    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Tổng quan quản trị: tài khoản theo trạng thái và vai trò, thao tác quản trị 30 ngày gần nhất theo ngày (giờ Việt Nam). Không đọc dữ liệu hồ sơ. */
  async dashboard(now: Date = new Date()) {
    const vnDay = (date: Date) => new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10);
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) days.push(vnDay(new Date(now.getTime() - i * 86_400_000)));
    const since = new Date(`${days[0]}T00:00:00+07:00`);
    const [users, logs] = await Promise.all([
      this.prisma.user.findMany({ select: { isActive: true, roles: { select: { role: { select: { code: true, name: true } } } } } }),
      this.prisma.adminAuditLog.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    ]);
    const byRole = new Map<string, { code: string; name: string; active: number; locked: number }>();
    for (const user of users) {
      for (const { role } of user.roles) {
        const entry = byRole.get(role.code) ?? { code: role.code, name: role.name, active: 0, locked: 0 };
        if (user.isActive) entry.active += 1; else entry.locked += 1;
        byRole.set(role.code, entry);
      }
    }
    const perDay = new Map(days.map(day => [day, 0]));
    for (const log of logs) { const day = vnDay(log.createdAt); if (perDay.has(day)) perDay.set(day, perDay.get(day)! + 1); }
    const active = users.filter(user => user.isActive).length;
    return {
      generatedAt: now,
      accounts: { total: users.length, active, locked: users.length - active },
      byRole: [...byRole.values()].sort((a, b) => a.code.localeCompare(b.code)),
      activity: days.map(day => ({ day, count: perDay.get(day)! })),
      activityTotal: logs.length,
    };
  }

  async roles() {
    const rows = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      select: { code: true, name: true, description: true, users: { select: { user: { select: { isActive: true } } } } },
    });
    return rows.map(({ users, ...role }) => ({
      ...role,
      activeUsers: users.filter(link => link.user.isActive).length,
      totalUsers: users.length,
    }));
  }

  /** Bối cảnh cho màn Cấu hình SLA: hồ sơ đang mở theo công đoạn và dải định mức mô hình dự báo đã học. */
  async slaOverview() {
    const [open, prediction] = await Promise.all([
      this.prisma.loanApplication.groupBy({ by: ['currentStage'], where: { completedAt: null }, _count: { _all: true } }),
      this.predictionLimits(),
    ]);
    return {
      openLoans: Object.fromEntries(open.map(row => [row.currentStage, row._count._all])),
      prediction,
    };
  }

  /** Dải định mức mô hình đã học theo công đoạn; `null` khi dịch vụ dự báo không trả được metadata. */
  private async predictionLimits(): Promise<PredictionLimits | null> {
    const url = process.env.ML_SERVICE_URL ?? 'http://localhost:8000';
    try {
      const response = await fetch(`${url}/metadata`, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const meta = await response.json();
      if (!meta?.sla_grid_hours) throw new Error('metadata thiếu sla_grid_hours');
      const slaRangeHours = Object.fromEntries(
        Object.entries(meta.sla_grid_hours as Record<string, number[]>).map(([stage, grid]) => [stage, [Math.min(...grid), Math.max(...grid)] as [number, number]]),
      );
      return { slaRangeHours };
    } catch (error) {
      this.logger.warn(`Không đọc được metadata mô hình dự báo: ${(error as Error).message}`);
      return null;
    }
  }
}
