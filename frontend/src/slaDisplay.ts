// Cách hiển thị SLA và dự báo cho người dùng (C.9.2, mốc 3). Hàm thuần, không phụ thuộc React.

export type PredictionStatus = 'AVAILABLE' | 'INCOMPATIBLE_PA1' | 'NONE';
export interface SlaStateView { policy?: string | null; waiting?: 'ENTERPRISE' | 'BANK' | null; slaRunning?: boolean }

/** Tên cách tính của một công đoạn: null là cách cũ (giờ thực 24/7), 'PA1' là giờ làm việc. */
export function slaPolicyLabel(policy?: string | null): string {
  return policy === 'PA1' ? 'Giờ làm việc (PA1)' : 'Giờ thực (cách cũ)';
}

/** Hồ sơ đang chờ bên nào và đồng hồ SLA chạy hay dừng; null khi hồ sơ không ở trạng thái chờ bổ sung. */
export function slaStateLabel(state?: SlaStateView | null): string | null {
  if (!state?.waiting) return null;
  if (state.waiting === 'BANK') return 'Ngân hàng đang kiểm tra phản hồi · SLA đang chạy';
  return state.policy === 'PA1' ? 'Đang chờ doanh nghiệp bổ sung · SLA tạm dừng' : 'Chờ bổ sung · SLA tạm dừng (cách tính cũ)';
}

/** Nhãn khi không có dự báo: nói rõ lý do thay vì hiển thị mức hay xác suất không có thật. */
export function predictionLabel(status?: PredictionStatus | null): string {
  return status === 'INCOMPATIBLE_PA1' ? 'Chưa có dự báo tương thích PA1' : 'Chưa dự báo';
}

/** Số giờ làm tròn tới 2 chữ số thập phân; thiếu giá trị thì hiển thị gạch ngang. */
export function hoursText(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100) / 100}h`;
}

export const HOURS_PER_WORKING_DAY = 8;
const COMPLETED_STAGE = 'HOAN_TAT';

const decimalText = (value: number) => (Math.round(value * 100) / 100).toLocaleString('vi-VN');

export const hoursToDays = (hours: number) => hours / HOURS_PER_WORKING_DAY;
export const daysToHours = (days: number) => days * HOURS_PER_WORKING_DAY;

/** Thời lượng theo ngày làm việc, phần lẻ ghi bằng giờ. Ví dụ 37,5 giờ: "4 ngày 5,5 giờ". */
export function workingDurationText(hours?: number | null): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '—';
  const rounded = Math.round(hours * 100) / 100;
  const days = Math.floor(rounded / HOURS_PER_WORKING_DAY);
  const rest = Math.round((rounded - days * HOURS_PER_WORKING_DAY) * 10) / 10;
  if (days === 0) return `${decimalText(rest)} giờ`;
  return rest === 0 ? `${days} ngày` : `${days} ngày ${decimalText(rest)} giờ`;
}

/** Công đoạn PA1 hiển thị theo ngày làm việc; hồ sơ tính theo cách cũ giữ nguyên số giờ. */
export function stageDurationText(hours: number | null | undefined, policy?: string | null): string {
  return policy === 'PA1' ? workingDurationText(hours) : hoursText(hours);
}

/** Định mức của công đoạn; Hoàn tất không tính SLA. */
export function stageStandardText(stageCode: string | undefined, hours: number | null | undefined, policy: string | null = 'PA1'): string {
  if (stageCode === COMPLETED_STAGE) return 'Không tính SLA';
  if (hours === null || hours === undefined) return '—';
  return policy === 'PA1' ? `${decimalText(hoursToDays(hours))} ngày làm việc` : `${hours} giờ`;
}

export interface SlaSummaryView {
  policy?: string | null;
  standardHours?: number;
  netWorkHours?: number | null;
  remainingHours?: number | null;
  dueAt?: string | null;
  waitingEnterprise?: boolean;
  isOverdue?: boolean;
  error?: string | null;
}

export const dateTimeText = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const dueText = dateTimeText;

/** Tình trạng SLA đầy đủ trong chi tiết hồ sơ. */
export function slaSummaryText(summary: SlaSummaryView | null | undefined, completed: boolean): string {
  if (completed) return 'Không tính SLA';
  if (!summary) return 'Chưa có dữ liệu SLA';
  if (summary.netWorkHours === null || summary.netWorkHours === undefined) return summary.error ?? 'Chưa có dữ liệu SLA';
  const remaining = stageDurationText(summary.remainingHours, summary.policy);
  if (summary.waitingEnterprise) return `Tạm dừng · còn ${remaining}`;
  const due = summary.dueAt ? `Hạn ${dueText(summary.dueAt)}` : summary.policy === 'PA1' ? 'Hạn nằm ngoài kỳ lịch SLA' : null;
  if (summary.isOverdue) return due ? `Quá hạn · ${due}` : 'Quá hạn';
  return due ? `${due} · còn ${remaining}` : `Còn ${remaining}`;
}

export interface SlaDeadlineCell { text: string; detail: string; tone: 'normal' | 'danger' | 'muted' }

/** Cột hạn SLA trong danh sách thẩm định. */
export function slaDeadlineCell(summary: SlaSummaryView | null | undefined, finished = false): SlaDeadlineCell {
  if (finished) return { text: 'Không tính SLA', detail: '', tone: 'muted' };
  if (!summary) return { text: 'Chưa có dữ liệu', detail: '', tone: 'muted' };
  if (summary.error && summary.netWorkHours === null) return { text: 'Lỗi lịch SLA', detail: '', tone: 'muted' };
  const remaining = `còn ${stageDurationText(summary.remainingHours, summary.policy)}`;
  if (summary.waitingEnterprise) return { text: 'Tạm dừng', detail: remaining, tone: 'muted' };
  if (summary.dueAt) return summary.isOverdue ? { text: dueText(summary.dueAt), detail: 'Quá hạn', tone: 'danger' } : { text: dueText(summary.dueAt), detail: remaining, tone: 'normal' };
  if (summary.isOverdue) return { text: 'Quá hạn', detail: '', tone: 'danger' };
  return { text: summary.policy === 'PA1' ? 'Ngoài kỳ lịch SLA' : 'Theo cách cũ', detail: remaining, tone: 'muted' };
}

/** Bên đang chờ trên danh sách quá hạn của Quản lý. */
export function waitingOnLabel(waitingOn?: 'ENTERPRISE' | 'BANK' | null): string {
  if (waitingOn === 'BANK') return 'Chờ ngân hàng kiểm tra';
  return 'Chờ doanh nghiệp';
}
