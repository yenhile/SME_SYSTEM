// Báo cáo thống kê theo khoảng thời gian (Quản lý chi nhánh). Hàm thuần, không phụ thuộc React, để kiểm thử.

export interface PeriodReportData {
  range: { from: string; to: string; days: number };
  totals: { created: number; completed: number; approved: number; rejected: number; closedTimeout: number; approvalRate: number | null; approvedAmount: number };
  stages: { stageCode: string; handled: number; delayed: number; delayRate: number | null; avgNetWorkHours: number | null }[];
  byOfficer: { id: string; fullName: string; created: number; completed: number; approved: number; rejected: number; receptionHandled: number; receptionDelayed: number }[];
  byLoanType: { loanType: string; created: number; approved: number; approvedAmount: number }[];
  monthly: { month: string; created: number; completed: number }[];
  basis: string;
}

export type ReportPreset = '7' | '30' | 'month' | 'quarter' | 'year';
export const REPORT_PRESETS: { value: ReportPreset; label: string }[] = [
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: 'month', label: 'Tháng này' },
  { value: 'quarter', label: 'Quý này' },
  { value: 'year', label: 'Năm nay' },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const keyOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export const todayKey = (now = new Date()) => keyOf(now.getTime() + 7 * 60 * 60 * 1000);

/** Khoảng ngày của một mốc chọn nhanh, tính từ `today` (YYYY-MM-DD, giờ Việt Nam). */
export function presetRange(preset: ReportPreset, today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (preset === 'month') return { from: `${y}-${pad(m)}-01`, to: today };
  if (preset === 'quarter') return { from: `${y}-${pad(Math.floor((m - 1) / 3) * 3 + 1)}-01`, to: today };
  if (preset === 'year') return { from: `${y}-01-01`, to: today };
  const days = Number(preset);
  return { from: keyOf(Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY_MS), to: today };
}

export const dateText = (key: string) => key.split('-').reverse().join('/');
export const monthText = (key: string) => `${key.slice(5)}/${key.slice(0, 4)}`;
export const hoursText = (hours: number | null) => (hours === null ? '—' : `${hours.toLocaleString('vi-VN')} giờ`);
export const rateText = (rate: number | null) => (rate === null ? '—' : `${rate.toLocaleString('vi-VN')}%`);
export const vndText = (amount: number) => (amount >= 1e9 ? `${(amount / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ` : `${Math.round(amount / 1e6).toLocaleString('vi-VN')} triệu`);

const csvCell = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV nhiều phần cho Excel (người gọi thêm BOM UTF-8). `labels` đổi mã công đoạn, loại vay sang tên hiển thị. */
export function reportToCsv(report: PeriodReportData, labels: { stage: (code: string) => string; loanType: (code: string) => string }): string {
  const rows: (string | number | null)[][] = [];
  const t = report.totals;
  rows.push(['Báo cáo thống kê', `${dateText(report.range.from)} - ${dateText(report.range.to)}`, `${report.range.days} ngày`], []);
  rows.push(['Tổng quan'], ['Hồ sơ tạo mới', t.created], ['Hồ sơ hoàn tất', t.completed], ['Phê duyệt', t.approved], ['Từ chối', t.rejected], ['Đóng quá hạn', t.closedTimeout],
    ['Tỷ lệ phê duyệt (%)', t.approvalRate], ['Tổng tiền phê duyệt (VND)', t.approvedAmount], []);
  rows.push(['Theo công đoạn (giờ làm việc)'], ['Công đoạn', 'Số lượt kết thúc', 'Số lượt trễ', 'Tỷ lệ trễ (%)', 'Giờ ròng trung bình']);
  for (const s of report.stages) rows.push([labels.stage(s.stageCode), s.handled, s.delayed, s.delayRate, s.avgNetWorkHours]);
  rows.push([], ['Theo cán bộ tín dụng'], ['Cán bộ', 'Hồ sơ tạo mới', 'Hồ sơ hoàn tất', 'Phê duyệt', 'Từ chối', 'Tiếp nhận kết thúc', 'Tiếp nhận trễ']);
  for (const o of report.byOfficer) rows.push([o.fullName, o.created, o.completed, o.approved, o.rejected, o.receptionHandled, o.receptionDelayed]);
  rows.push([], ['Theo loại vay'], ['Loại vay', 'Hồ sơ tạo mới', 'Phê duyệt', 'Tiền phê duyệt (VND)']);
  for (const l of report.byLoanType) rows.push([labels.loanType(l.loanType), l.created, l.approved, l.approvedAmount]);
  rows.push([], ['Theo tháng'], ['Tháng', 'Hồ sơ tạo mới', 'Hồ sơ hoàn tất']);
  for (const m of report.monthly) rows.push([monthText(m.month), m.created, m.completed]);
  rows.push([], [report.basis]);
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
