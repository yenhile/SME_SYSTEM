import { BadRequestException } from '@nestjs/common';

/** Báo cáo thống kê theo khoảng thời gian cho Quản lý chi nhánh. Hàm thuần để kiểm thử; việc đọc dữ liệu nằm ở DashboardService. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 366;
const DEFAULT_DAYS = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ReportRange { from: string; to: string; start: Date; end: Date; days: number }

/** Ngày theo giờ Việt Nam, dạng YYYY-MM-DD. */
export const vnDateKey = (date: Date) => new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
const dayStart = (key: string) => new Date(`${key}T00:00:00+07:00`);

/** `to` mặc định là hôm nay, `from` mặc định lùi 29 ngày; đầu mút tính theo giờ Việt Nam, bao gồm cả ngày cuối. */
export function parseReportRange(fromRaw: string | undefined, toRaw: string | undefined, now: Date): ReportRange {
  const today = vnDateKey(now);
  const to = toRaw || today;
  const from = fromRaw || vnDateKey(new Date(dayStart(to).getTime() - (DEFAULT_DAYS - 1) * DAY_MS));
  for (const [name, value] of [['from', from], ['to', to]] as const) {
    if (!DATE_RE.test(value) || Number.isNaN(dayStart(value).getTime()) || vnDateKey(dayStart(value)) !== value) throw new BadRequestException(`Ngày "${name}" không hợp lệ, cần dạng YYYY-MM-DD.`);
  }
  if (from > to) throw new BadRequestException('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  if (to > today) throw new BadRequestException('Ngày kết thúc không được ở tương lai.');
  const start = dayStart(from);
  const end = new Date(dayStart(to).getTime() + DAY_MS);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  if (days > MAX_DAYS) throw new BadRequestException(`Khoảng thời gian tối đa ${MAX_DAYS} ngày.`);
  return { from, to, start, end, days };
}

export interface ReportLoan { createdAt: Date; completedAt: Date | null; currentStatus: string; loanType: string; proposedAmount: unknown; approvedAmount: unknown; assignedTo: string | null }
export interface ReportStage { stageCode: string; handledBy: string | null; netWorkDurationHours: number | null; isDelayed: boolean }

const num = (value: unknown) => Number(value ?? 0) || 0;
const round1 = (value: number) => Math.round(value * 10) / 10;
const rate = (part: number, whole: number) => (whole > 0 ? round1((part / whole) * 100) : null);

function monthKeys(range: ReportRange): string[] {
  const keys: string[] = [];
  const last = range.to.slice(0, 7);
  let [y, m] = range.from.slice(0, 7).split('-').map(Number);
  for (let guard = 0; guard < 14; guard++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    keys.push(key);
    if (key >= last) break;
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return keys;
}

export function buildPeriodReport(input: { range: ReportRange; created: ReportLoan[]; completed: ReportLoan[]; stages: ReportStage[]; officerNames: Record<string, string> }) {
  const { range, created, completed, stages, officerNames } = input;
  const approved = completed.filter(l => l.currentStatus === 'APPROVED');
  const rejected = completed.filter(l => l.currentStatus === 'REJECTED');
  const timeout = completed.filter(l => l.currentStatus === 'CLOSED_TIMEOUT');

  const stageRows = ['TIEP_NHAN', 'THAM_DINH'].map(code => {
    const rows = stages.filter(s => s.stageCode === code);
    const delayed = rows.filter(s => s.isDelayed).length;
    const hours = rows.map(s => s.netWorkDurationHours ?? 0);
    return { stageCode: code, handled: rows.length, delayed, delayRate: rate(delayed, rows.length), avgNetWorkHours: rows.length ? round1(hours.reduce((a, b) => a + b, 0) / rows.length) : null };
  });

  const officerIds = new Set<string>();
  for (const l of [...created, ...completed]) if (l.assignedTo) officerIds.add(l.assignedTo);
  for (const s of stages) if (s.handledBy) officerIds.add(s.handledBy);
  const byOfficer = [...officerIds]
    .map(id => {
      const mine = completed.filter(l => l.assignedTo === id);
      const tn = stages.filter(s => s.stageCode === 'TIEP_NHAN' && s.handledBy === id);
      return {
        id, fullName: officerNames[id] ?? id,
        created: created.filter(l => l.assignedTo === id).length,
        completed: mine.length,
        approved: mine.filter(l => l.currentStatus === 'APPROVED').length,
        rejected: mine.filter(l => l.currentStatus === 'REJECTED').length,
        receptionHandled: tn.length,
        receptionDelayed: tn.filter(s => s.isDelayed).length,
      };
    })
    .filter(o => o.created + o.completed + o.receptionHandled > 0)
    .sort((a, b) => b.created + b.completed - (a.created + a.completed) || a.fullName.localeCompare(b.fullName, 'vi'));

  const types = new Set([...created, ...completed].map(l => l.loanType));
  const byLoanType = [...types].sort().map(loanType => ({
    loanType,
    created: created.filter(l => l.loanType === loanType).length,
    approved: approved.filter(l => l.loanType === loanType).length,
    approvedAmount: approved.filter(l => l.loanType === loanType).reduce((sum, l) => sum + num(l.approvedAmount), 0),
  }));

  const bucket = (date: Date) => vnDateKey(date).slice(0, 7);
  const monthly = monthKeys(range).map(month => ({
    month,
    created: created.filter(l => bucket(l.createdAt) === month).length,
    completed: completed.filter(l => l.completedAt && bucket(l.completedAt) === month).length,
  }));

  return {
    range: { from: range.from, to: range.to, days: range.days },
    totals: {
      created: created.length, completed: completed.length, approved: approved.length, rejected: rejected.length, closedTimeout: timeout.length,
      approvalRate: rate(approved.length, approved.length + rejected.length),
      approvedAmount: approved.reduce((sum, l) => sum + num(l.approvedAmount), 0),
    },
    stages: stageRows,
    byOfficer,
    byLoanType,
    monthly,
    basis: 'Công đoạn tính theo giờ làm việc (PA1), chỉ các công đoạn kết thúc trong kỳ; hồ sơ tính theo ngày tạo và ngày hoàn tất (giờ Việt Nam).',
  };
}
