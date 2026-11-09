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

// ---- Mức cảnh báo của mô hình dự báo trễ SLA (v4) ----
export type AlertCode = 'BINH_THUONG' | 'CHU_Y' | 'KHAN' | 'QUA_HAN';
export interface AlertView { code: AlertCode; label: string; tone: 'green' | 'amber' | 'red' }

/**
 * Mức cảnh báo từ mức nguy cơ đã lưu: THẤP → Bình thường, TRUNG BÌNH → Chú ý (xác suất từ 35%), CAO → Khẩn (từ 60%).
 * Xác suất đúng 1 chỉ do đường "đã vượt SLA" của dịch vụ dự báo tạo ra (mô hình luôn nhỏ hơn 1), nên hiện là Quá hạn.
 * Không có mức thì trả null: giao diện nói "chưa dự báo", không bịa mức.
 */
export function alertDisplay(riskLevel?: string | null, probability?: number | null, overdue?: boolean): AlertView | null {
  if (!riskLevel) return null;
  // Quá hạn do backend tính theo thời gian thực (slaOverdue) nên không phải chờ lượt chấm điểm kế tiếp; khi biết cờ này thì không suy ra từ xác suất 100%.
  if (overdue === true) return { code: 'QUA_HAN', label: 'Quá hạn', tone: 'red' };
  if (overdue === undefined && probability !== null && probability !== undefined && probability >= 1) return { code: 'QUA_HAN', label: 'Quá hạn', tone: 'red' };
  if (riskLevel === 'CAO') return { code: 'KHAN', label: 'Khẩn', tone: 'red' };
  if (riskLevel === 'TRUNG_BINH') return { code: 'CHU_Y', label: 'Chú ý', tone: 'amber' };
  return { code: 'BINH_THUONG', label: 'Bình thường', tone: 'green' };
}

/** "Dự báo lúc 14:05 09/11": các lý do (số giờ còn lại...) được tính tại thời điểm này nên có thể lệch với cột SLA tính theo thời gian thực. */
export function predictedAtText(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const vn = new Date(date.getTime() + 7 * 3600000);   // giờ Việt Nam, không phụ thuộc múi giờ và ngôn ngữ của trình duyệt
  const two = (n: number) => String(n).padStart(2, "0");
  const time = `${two(vn.getUTCHours())}:${two(vn.getUTCMinutes())}`;
  const day = `${two(vn.getUTCDate())}/${two(vn.getUTCMonth() + 1)}`;
  return `Dự báo lúc ${time} ${day}`;
}

export interface PredictionView { riskLevel: string; delayProbability: number; modelVersion?: string; predictionTimestamp?: string }

/** Ví dụ "Khẩn · 72,9%". */
export function predictionHeadline(prediction: PredictionView, digits = 1): string {
  const alert = alertDisplay(prediction.riskLevel, prediction.delayProbability);
  const percent = `${(prediction.delayProbability * 100).toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
  return `${alert?.label ?? prediction.riskLevel} · ${percent}`;
}

/** Số giờ làm việc còn lại đến hạn SLA, ví dụ "còn 1 ngày 3 giờ"; hồ sơ tạm dừng hoặc quá hạn được nói rõ. */
export function slaLeftText(item: { slaRemainingHours?: number | null; slaOverdue?: boolean; slaWaiting?: boolean }): string | null {
  if (item.slaWaiting) return 'SLA tạm dừng (chờ doanh nghiệp)';
  if (item.slaOverdue) return 'Đã quá hạn SLA';
  if (item.slaRemainingHours === null || item.slaRemainingHours === undefined) return null;
  return `còn ${workingDurationText(item.slaRemainingHours)} làm việc`;
}

/** Thứ tự ưu tiên xử lý: Quá hạn, Khẩn, Chú ý, Bình thường, chưa có dự báo; cùng mức thì xác suất cao hơn trước. */
const ALERT_RANK: Record<AlertCode, number> = { QUA_HAN: 0, KHAN: 1, CHU_Y: 2, BINH_THUONG: 3 };
export function compareAlerts(a: { riskLevel?: string | null; delayProbability?: number | null; slaOverdue?: boolean }, b: { riskLevel?: string | null; delayProbability?: number | null; slaOverdue?: boolean }): number {
  const rank = (x: typeof a) => (x.slaOverdue ? ALERT_RANK.QUA_HAN : (() => { const alert = alertDisplay(x.riskLevel, x.delayProbability, false); return alert ? ALERT_RANK[alert.code] : 4; })());
  return rank(a) - rank(b) || (b.delayProbability ?? -1) - (a.delayProbability ?? -1);
}
