export interface ChartSeries { key: string; label: string; color: string }

/** Bảng màu phân loại đã qua bộ kiểm độ tách màu (kể cả mù màu) trên nền sáng; dùng theo thứ tự cố định. */
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#6250d6'] as const;
/** Màu trạng thái chỉ dùng cho tình trạng SLA và mức cảnh báo, luôn đi kèm nhãn chữ. */
export const STATUS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b', neutral: '#8a94a6', muted: '#c7cdd6' } as const;

export const SLA_SERIES: ChartSeries[] = [
  { key: 'overdue', label: 'Quá hạn', color: STATUS.critical },
  { key: 'dueSoon', label: 'Sắp hết hạn', color: STATUS.warning },
  { key: 'onTime', label: 'Trong hạn', color: STATUS.good },
  { key: 'paused', label: 'Tạm dừng (chờ doanh nghiệp)', color: STATUS.neutral },
  { key: 'unknown', label: 'Chưa xác định', color: STATUS.muted },
];

export type SlaCounts = { onTime: number; dueSoon: number; overdue: number; paused: number; unknown: number };

/** Các chuỗi SLA có ít nhất một hồ sơ (bỏ "Chưa xác định" khi bằng 0) và giá trị theo từng nhóm. */
export function slaStack(groups: SlaCounts[]): { series: ChartSeries[]; values: number[][] } {
  const series = SLA_SERIES.filter(s => s.key !== 'unknown' || groups.some(g => g.unknown > 0));
  return { series, values: series.map(s => groups.map(g => g[s.key as keyof SlaCounts])) };
}

/** Mốc trục y tròn số (0 và 3–5 mốc), luôn là số nguyên vì đơn vị là hồ sơ hoặc lượt. */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map(m => m * power).find(s => s >= rough) ?? 10 * power);
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) ticks.push(Math.round(v));
  return ticks;
}

/** "2026-10" → "T10/26". */
export const monthLabel = (key: string) => `T${Number(key.slice(5, 7))}/${key.slice(2, 4)}`;

/** Khoảng nhãn trục thời gian đủ để nhãn không đè nhau ở độ rộng hiện có (ước 6,5px mỗi ký tự cỡ 11px). */
export function labelStep(count: number, plotWidth: number, longest: number, minimum = 1): number {
  if (count < 2 || plotWidth <= 0) return Math.max(1, minimum);
  const spacing = plotWidth / (count - 1);
  return Math.max(minimum, Math.ceil((longest * 6.5 + 10) / spacing));
}
/** "2026-10-28" → "28/10". */
export const dayLabel = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

/** Khoảng sáu tháng gần nhất cho báo cáo theo kỳ: từ ngày 1 của tháng cũ nhất đến hôm nay (giờ Việt Nam). */
export function sixMonthRange(today: string): { from: string; to: string } {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const start = new Date(Date.UTC(y, m - 6, 1));
  return { from: start.toISOString().slice(0, 10), to: today };
}

/** Nối các tháng của báo cáo theo kỳ thành đủ dãy tháng, tháng không có dữ liệu là 0. */
export function monthlySeries(monthly: { month: string; created: number; completed: number }[], range: { from: string; to: string }) {
  const months: string[] = [];
  const cursor = new Date(`${range.from.slice(0, 7)}-01T00:00:00Z`);
  const end = range.to.slice(0, 7);
  while (cursor.toISOString().slice(0, 7) <= end) { months.push(cursor.toISOString().slice(0, 7)); cursor.setUTCMonth(cursor.getUTCMonth() + 1); }
  const byMonth = new Map(monthly.map(m => [m.month, m]));
  return { months, created: months.map(m => byMonth.get(m)?.created ?? 0), completed: months.map(m => byMonth.get(m)?.completed ?? 0) };
}

/** Nhãn trục tối đa hai dòng theo số ký tự vừa một cột; phần dư bị cắt và có dấu "…". */
export function wrapLabel(text: string, maxChars: number): string[] {
  const limit = Math.max(4, Math.floor(maxChars));
  if (text.length <= limit) return [text];
  const words = text.split(' ');
  const lines: string[] = [''];
  for (const word of words) {
    const current = lines[lines.length - 1];
    if (!current) lines[lines.length - 1] = word;
    else if (`${current} ${word}`.length <= limit) lines[lines.length - 1] = `${current} ${word}`;
    else lines.push(word);
  }
  const shown = lines.slice(0, 2).map(line => (line.length > limit ? `${line.slice(0, limit - 1)}…` : line));
  if (lines.length > 2) shown[1] = `${shown[1].slice(0, limit - 1).replace(/…$/, '')}…`;
  return shown;
}

/** Các vị trí nhãn trục thời gian: mỗi `every` điểm và điểm cuối, bỏ nhãn quá sát điểm cuối để không đè nhau. */
export function tickIndexes(count: number, every: number): number[] {
  if (count <= 0) return [];
  const step = Math.max(1, every);
  const picked = [];
  for (let i = 0; i < count - 1; i += step) if (count - 1 - i >= Math.ceil(step / 2)) picked.push(i);
  picked.push(count - 1);
  return picked;
}

/** Hồ sơ hoàn tất trong kỳ của từng CBTD theo kết quả; xếp theo tên để không đọc thành bảng xếp hạng năng suất. */
export function officerResults(byOfficer: { id: string; fullName: string; completed: number; approved: number; rejected: number }[]) {
  return byOfficer
    .filter(o => o.completed > 0)
    .map(o => ({ id: o.id, name: o.fullName, completed: o.completed, approved: o.approved, rejected: o.rejected, closedTimeout: Math.max(0, o.completed - o.approved - o.rejected) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}
