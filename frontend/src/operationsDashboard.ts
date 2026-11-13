export type SlaState = 'OVERDUE' | 'DUE_SOON' | 'PAUSED' | 'ON_TIME' | 'UNKNOWN';

/** Cùng ngưỡng với backend: công đoạn tính theo giờ làm việc còn không quá 8 giờ là sắp hết hạn. */
export const DUE_SOON_WORKING_HOURS = 8;
export type MlLevel = 'KHAN' | 'CHU_Y' | 'BINH_THUONG' | 'NONE';
export type Tone = 'red' | 'amber' | 'green' | 'gray' | 'blue';

export interface OperationsRow {
  id: string;
  applicationCode: string;
  companyName: string;
  currentStage: string;
  currentStatus: string;
  assignedOfficerId: string | null;
  assignedOfficer: string | null;
  slaState: SlaState;
  slaDueAt: string | null;
  slaRemainingHours: number | null;
  mlLevel: MlLevel;
  delayProbability: number | null;
  predictedAt: string | null;
  topReason: string | null;
}

export interface OperationsDashboard {
  generatedAt: string;
  scope: { role: string; stages: string[] };
  filters: { stage: string | null; officerId: string | null };
  kpis: {
    active: number;
    overdue: number;
    dueSoon: number;
    ml: { flagged: number; urgent: number; watch: number; none: number };
    myTurn: { status: 'AVAILABLE' | 'PENDING_PO' | 'NOT_APPLICABLE'; value: number | null };
  };
  stageDistribution: { stage: string; total: number; waitingEnterprise: number }[];
  slaByStage: { stage: string; onTime: number; dueSoon: number; overdue: number; paused: number; unknown: number }[];
  sla: { onTime: number; dueSoon: number; overdue: number; paused: number; unknown: number };
  ml: { overdueExcluded: number; predictedScope: number; urgent: number; watch: number; normal: number; none: number };
  officerLoad: { officerId: string | null; name: string | null; total: number; onTime: number; dueSoon: number; overdue: number; paused: number; unknown: number }[];
  unassigned: { loans: number; portalRequests: number } | null;
  officers: { id: string; name: string }[];
  priority: { items: OperationsRow[]; total: number; page: number; pageSize: number };
}

export interface OperationsFilters { stage: string; officerId: string }

export const OPERATIONS_PAGE_SIZE = 10;

const STAGE_LABELS: Record<string, string> = { TIEP_NHAN: 'Tiếp nhận', THAM_DINH: 'Thẩm định', HOAN_TAT: 'Hoàn tất' };
export const operationsStageLabel = (stage: string) => STAGE_LABELS[stage] ?? stage;

export function operationsQuery(filters: OperationsFilters, page: number): string {
  const params = new URLSearchParams({ page: String(page), pageSize: String(OPERATIONS_PAGE_SIZE) });
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.officerId) params.set('officerId', filters.officerId);
  return `/dashboard/operations?${params.toString()}`;
}

export function stageChoices(stages: string[]): [string, string][] {
  return stages.map(stage => [stage, operationsStageLabel(stage)] as [string, string]);
}

const SLA_VIEW: Record<SlaState, { label: string; tone: Tone }> = {
  OVERDUE: { label: 'Quá hạn', tone: 'red' },
  PAUSED: { label: 'Tạm dừng', tone: 'gray' },
  DUE_SOON: { label: 'Sắp hết hạn', tone: 'amber' },
  ON_TIME: { label: 'Trong hạn', tone: 'green' },
  UNKNOWN: { label: 'Chưa xác định', tone: 'gray' },
};
export const slaStateView = (state: SlaState) => SLA_VIEW[state] ?? SLA_VIEW.UNKNOWN;

const ML_VIEW: Record<MlLevel, { label: string; tone: Tone }> = {
  KHAN: { label: 'Khẩn', tone: 'red' },
  CHU_Y: { label: 'Chú ý', tone: 'amber' },
  BINH_THUONG: { label: 'Bình thường', tone: 'green' },
  NONE: { label: 'Chưa có dự báo', tone: 'gray' },
};
export const mlLevelView = (level: MlLevel) => ML_VIEW[level] ?? ML_VIEW.NONE;

/** Ô cảnh báo của một dòng. Quá hạn là sự kiện thực tế đã hiện ở cột SLA nên không xếp mức dự báo và không hiện xác suất của mô hình. */
export function mlCellView(row: Pick<OperationsRow, 'slaState' | 'mlLevel' | 'delayProbability'>): { label: string; tone: Tone } {
  if (row.slaState === 'OVERDUE') return { label: 'Không xếp mức', tone: 'gray' };
  const view = mlLevelView(row.mlLevel);
  if (row.delayProbability === null) return view;
  return { label: `${view.label} · ${(row.delayProbability * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`, tone: view.tone };
}

interface HandledCounts { totalHandled: number; delayedCount: number }

/** Tỷ lệ đúng hạn của các công đoạn đã kết thúc: dùng giờ làm việc (PA1) khi đã có lượt PA1, nếu chưa thì dùng cách tính cũ. */
export function onTimeSummary(stages: (HandledCounts & { pa1?: HandledCounts | null })[]): { rate: number | null; onTime: number; total: number; basis: 'PA1' | 'LEGACY' } {
  const sum = (pick: (stage: HandledCounts & { pa1?: HandledCounts | null }) => HandledCounts | null | undefined) =>
    stages.reduce((acc, stage) => { const v = pick(stage); return v ? { total: acc.total + v.totalHandled, delayed: acc.delayed + v.delayedCount } : acc; }, { total: 0, delayed: 0 });
  const pa1 = sum(stage => stage.pa1);
  const chosen = pa1.total > 0 ? pa1 : sum(stage => stage);
  const onTime = chosen.total - chosen.delayed;
  return { rate: chosen.total > 0 ? Math.round((onTime / chosen.total) * 1000) / 10 : null, onTime, total: chosen.total, basis: pa1.total > 0 ? 'PA1' : 'LEGACY' };
}

/** Tình trạng SLA từ bản tóm tắt của một hồ sơ trong danh sách, cùng quy tắc với dashboard. */
export function slaStateOfSummary(s: { policy?: string | null; netWorkHours?: number | null; remainingHours?: number | null; waitingEnterprise?: boolean; isOverdue?: boolean } | null | undefined): SlaState {
  if (!s || s.netWorkHours === null || s.netWorkHours === undefined) return 'UNKNOWN';
  if (s.waitingEnterprise) return 'PAUSED';
  if (s.isOverdue) return 'OVERDUE';
  if (s.policy === 'PA1' && s.remainingHours !== null && s.remainingHours !== undefined && s.remainingHours <= DUE_SOON_WORKING_HOURS) return 'DUE_SOON';
  return 'ON_TIME';
}
