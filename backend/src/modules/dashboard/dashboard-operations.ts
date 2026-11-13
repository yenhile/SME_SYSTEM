import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LoanStatus, RoleCode, StageCode } from '@prisma/client';
import { SLA_POLICY_PA1, type StageSlaSummary } from '../workflow/sla/sla-policy';

export const ACTIVE_STATUSES: LoanStatus[] = [LoanStatus.RECEIVED, LoanStatus.CHECKED, LoanStatus.SUPPLEMENT_REQUIRED, LoanStatus.PENDING_APPRAISAL];
const OPEN_STAGES: StageCode[] = [StageCode.TIEP_NHAN, StageCode.THAM_DINH];
const DASHBOARD_ROLES: string[] = [RoleCode.QUAN_LY, RoleCode.THAM_QUYEN, RoleCode.ADMIN];
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export type SlaState = 'OVERDUE' | 'DUE_SOON' | 'PAUSED' | 'ON_TIME' | 'UNKNOWN';

/** Công đoạn tính theo giờ làm việc còn không quá 1 ngày làm việc (8 giờ) thì là sắp hết hạn. */
export const DUE_SOON_WORKING_HOURS = 8;
export type MlLevel = 'KHAN' | 'CHU_Y' | 'BINH_THUONG' | 'NONE';
export type MyTurnStatus = 'AVAILABLE' | 'PENDING_PO' | 'NOT_APPLICABLE';

export interface OperationsQuery { stage?: string; officerId?: string; page?: string; pageSize?: string }

export interface OperationsRow {
  id: string;
  applicationCode: string;
  companyName: string;
  currentStage: StageCode;
  currentStatus: LoanStatus;
  assignedOfficerId: string | null;
  assignedOfficer: string | null;
  slaState: SlaState;
  slaDueAt: Date | null;
  slaRemainingHours: number | null;
  mlLevel: MlLevel;
  delayProbability: number | null;
  predictedAt: Date | null;
  topReason: string | null;
}

/** Thẩm quyền chỉ làm việc từ Thẩm định trở đi; Quản lý và Admin theo dõi cả hai công đoạn đang mở. */
export function operationsScope(activeRole: string | undefined): StageCode[] {
  if (!activeRole || !DASHBOARD_ROLES.includes(activeRole)) throw new ForbiddenException('Vai trò của bạn không xem được dashboard vận hành.');
  return activeRole === RoleCode.THAM_QUYEN ? [StageCode.THAM_DINH] : OPEN_STAGES;
}

function positiveInteger(value: string | undefined, fallback: number, label: string, max = Number.MAX_SAFE_INTEGER): number {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) throw new BadRequestException(`${label} không hợp lệ.`);
  return Number(value);
}

export function parseOperationsQuery(query: OperationsQuery, scope: StageCode[]) {
  if (query.stage !== undefined && query.stage !== '' && !scope.includes(query.stage as StageCode)) throw new BadRequestException('Công đoạn không thuộc phạm vi của vai trò.');
  if (query.officerId !== undefined && (typeof query.officerId !== 'string' || query.officerId.length > 64)) throw new BadRequestException('Cán bộ phụ trách không hợp lệ.');
  return {
    stage: query.stage ? (query.stage as StageCode) : null,
    officerId: query.officerId || null,
    page: positiveInteger(query.page, 1, 'Trang'),
    pageSize: positiveInteger(query.pageSize, DEFAULT_PAGE_SIZE, 'Số dòng mỗi trang', MAX_PAGE_SIZE),
  };
}

export function slaStateOf(sla: StageSlaSummary | null): SlaState {
  if (!sla || sla.netWorkHours === null) return 'UNKNOWN';
  if (sla.waitingEnterprise) return 'PAUSED';
  if (sla.isOverdue) return 'OVERDUE';
  // Cách tính cũ đo bằng giờ thực 24/7 nên không dùng ngưỡng giờ làm việc.
  if (sla.policy === SLA_POLICY_PA1 && sla.remainingHours !== null && sla.remainingHours <= DUE_SOON_WORKING_HOURS) return 'DUE_SOON';
  return 'ON_TIME';
}

/** Mức nguy cơ đã lưu theo công đoạn (Thẩm định không có Chú ý); không có dự báo hợp lệ thì là NONE, không coi là Bình thường. */
export function mlLevelOf(riskLevel: string | null | undefined): MlLevel {
  if (riskLevel === 'CAO') return 'KHAN';
  if (riskLevel === 'TRUNG_BINH') return 'CHU_Y';
  if (riskLevel === 'THAP') return 'BINH_THUONG';
  return 'NONE';
}

const ML_RANK: Record<MlLevel, number> = { KHAN: 0, CHU_Y: 1, BINH_THUONG: 2, NONE: 3 };

/** Quá hạn SLA trước, rồi mức cảnh báo của mô hình, rồi hồ sơ còn ít giờ làm việc hơn. */
export function comparePriority(a: OperationsRow, b: OperationsRow): number {
  return Number(b.slaState === 'OVERDUE') - Number(a.slaState === 'OVERDUE')
    || ML_RANK[a.mlLevel] - ML_RANK[b.mlLevel]
    || (a.slaRemainingHours ?? Number.POSITIVE_INFINITY) - (b.slaRemainingHours ?? Number.POSITIVE_INFINITY)
    || a.applicationCode.localeCompare(b.applicationCode);
}

type SlaCounts = { onTime: number; dueSoon: number; overdue: number; paused: number; unknown: number };
const emptySla = (): SlaCounts => ({ onTime: 0, dueSoon: 0, overdue: 0, paused: 0, unknown: 0 });
const SLA_KEY: Record<SlaState, keyof SlaCounts> = { ON_TIME: 'onTime', DUE_SOON: 'dueSoon', OVERDUE: 'overdue', PAUSED: 'paused', UNKNOWN: 'unknown' };

export function countSla<T extends { slaState: SlaState }>(rows: T[]): SlaCounts {
  const counts = emptySla();
  for (const row of rows) counts[SLA_KEY[row.slaState]] += 1;
  return counts;
}

/**
 * Hồ sơ quá hạn SLA là sự kiện thực tế nên không xếp vào mức dự báo nào: `overdueExcluded` + `predictedScope` = tổng hồ sơ,
 * và Khẩn + Chú ý + Bình thường + chưa có dự báo = `predictedScope`.
 */
export function countMl(rows: OperationsRow[]) {
  const ml = { overdueExcluded: 0, predictedScope: 0, urgent: 0, watch: 0, normal: 0, none: 0 };
  for (const row of rows) {
    if (row.slaState === 'OVERDUE') { ml.overdueExcluded += 1; continue; }
    ml.predictedScope += 1;
    if (row.mlLevel === 'KHAN') ml.urgent += 1;
    else if (row.mlLevel === 'CHU_Y') ml.watch += 1;
    else if (row.mlLevel === 'BINH_THUONG') ml.normal += 1;
    else ml.none += 1;
  }
  return ml;
}

export function summarizeOperations(rows: OperationsRow[], scope: StageCode[]) {
  const sla = countSla(rows);
  const ml = countMl(rows);
  const stageDistribution = scope.map(stage => {
    const inStage = rows.filter(row => row.currentStage === stage);
    return { stage, total: inStage.length, waitingEnterprise: inStage.filter(row => row.currentStatus === LoanStatus.SUPPLEMENT_REQUIRED).length };
  });
  const slaByStage = scope.map(stage => ({ stage, ...countSla(rows.filter(row => row.currentStage === stage)) }));
  return {
    kpis: { active: rows.length, overdue: sla.overdue, dueSoon: sla.dueSoon, ml: { flagged: ml.urgent + ml.watch, urgent: ml.urgent, watch: ml.watch, none: ml.none } },
    stageDistribution,
    slaByStage,
    sla,
    ml,
  };
}

/** Hồ sơ đang phụ trách theo CBTD, chia theo tình trạng SLA; hồ sơ chưa có CBTD đứng cuối với `officerId` null. Đây là tồn đọng, không phải năng suất. */
export function officerLoad(rows: OperationsRow[]) {
  const groups = new Map<string | null, OperationsRow[]>();
  for (const row of rows) groups.set(row.assignedOfficerId, [...(groups.get(row.assignedOfficerId) ?? []), row]);
  return [...groups].map(([officerId, items]) => ({ officerId, name: items[0].assignedOfficer, total: items.length, ...countSla(items) }))
    .sort((a, b) => Number(a.officerId === null) - Number(b.officerId === null) || b.total - a.total || (a.name ?? '').localeCompare(b.name ?? '', 'vi'));
}

/** Sáu tháng gần nhất theo giờ Việt Nam, cũ trước, dạng `YYYY-MM`. */
export function recentMonths(now: Date, count = 6): string[] {
  const vn = new Date(now.getTime() + 7 * 3600000);
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

/** Thời điểm bắt đầu tháng cũ nhất trong `recentMonths`, giờ Việt Nam. */
export function monthsStart(now: Date, count = 6): Date {
  return new Date(`${recentMonths(now, count)[0]}-01T00:00:00+07:00`);
}

export const vnMonthKey = (date: Date) => new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 7);

export function officerChoices(rows: OperationsRow[]): { id: string; name: string }[] {
  const byId = new Map<string, string>();
  for (const row of rows) if (row.assignedOfficerId && row.assignedOfficer) byId.set(row.assignedOfficerId, row.assignedOfficer);
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}
