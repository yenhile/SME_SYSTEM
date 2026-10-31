/**
 * SLA PA1 — bộ tính giờ làm việc dùng chung (C.9.2, C.9.4 mốc 1).
 * Thứ Hai–thứ Sáu, 08:00–12:00 và 13:00–17:00 giờ Việt Nam (UTC+7, không có giờ mùa hè), loại ngày nghỉ theo lịch.
 * Hàm thuần túy: không đọc đồng hồ hệ thống, không truy cập DB; thời gian đầu vào luôn do người gọi truyền vào.
 */

const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;
const VN_OFFSET_MS = 7 * HOUR_MS;

/** Các ca làm việc trong ngày, tính bằng phút kể từ 00:00 giờ Việt Nam. */
export const WORKING_SESSIONS: ReadonlyArray<{ startMinute: number; endMinute: number }> = [
  { startMinute: 8 * 60, endMinute: 12 * 60 },
  { startMinute: 13 * 60, endMinute: 17 * 60 },
];

/** Lịch có phiên bản: khoảng ngày được bao phủ (theo ngày Việt Nam, gồm cả hai đầu) và danh sách ngày nghỉ. */
export interface SlaCalendar {
  version: string;
  coverageFrom: string;
  coverageTo: string;
  holidays: ReadonlyArray<string>;
}

/**
 * Lịch mô phỏng phiên bản 1 phục vụ nghiệm thu (C.9.3): 26/10–08/11/2026, 30/10 là ngày nghỉ giả lập.
 * Không phải lịch nghỉ chính thức của ngân hàng.
 */
export const SIMULATED_CALENDAR_V1: SlaCalendar = {
  version: 'SIM-20261026-20261108-v1',
  coverageFrom: '2026-10-26',
  coverageTo: '2026-11-08',
  holidays: ['2026-10-30'],
};

/** Khoảng tạm dừng; `end = null` là khoảng còn mở và được tính đến thời điểm `until` của lần gọi. */
export interface PauseInterval {
  start: Date;
  end: Date | null;
}

/** Khoảng thời gian cần tính nằm ngoài kỳ bao phủ của lịch; không tự quay về tính 24/7. */
export class CalendarCoverageError extends Error {
  constructor(public readonly calendarVersion: string, public readonly dateKey: string) {
    super(`Lịch SLA ${calendarVersion} không bao phủ ngày ${dateKey}. Cần trình lịch kế tiếp trước khi tính.`);
    this.name = 'CalendarCoverageError';
  }
}

const dateKeyOf = (ms: number): string => new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
const midnightUtcMs = (dateKey: string): number => Date.parse(`${dateKey}T00:00:00Z`) - VN_OFFSET_MS;
const weekdayOf = (dateKey: string): number => new Date(`${dateKey}T00:00:00Z`).getUTCDay();

type Segment = [number, number];

function mergeSegments(segments: Segment[]): Segment[] {
  const sorted = segments.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const merged: Segment[] = [];
  for (const [a, b] of sorted) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}

function assertCovered(calendar: SlaCalendar, ms: number): void {
  const key = dateKeyOf(ms);
  if (key < calendar.coverageFrom || key > calendar.coverageTo) throw new CalendarCoverageError(calendar.version, key);
}

/**
 * Số mili giây làm việc giữa `start` và `end`, đã loại các khoảng tạm dừng.
 * Chỉ loại phần tạm dừng nằm trong giờ làm việc (không trừ nghỉ trưa, cuối tuần hay ngày nghỉ hai lần);
 * các khoảng tạm dừng chồng nhau được gộp trước khi trừ. `end <= start` trả về 0.
 */
export function workingMillisBetween(start: Date, end: Date, calendar: SlaCalendar, pauses: ReadonlyArray<PauseInterval> = []): number {
  const from = start.getTime();
  const to = end.getTime();
  if (!(to > from)) return 0;
  assertCovered(calendar, from);
  assertCovered(calendar, to);

  const holidays = new Set(calendar.holidays);
  const working: Segment[] = [];
  for (let day = midnightUtcMs(dateKeyOf(from)); day <= to; day += DAY_MS) {
    const key = dateKeyOf(day);
    const weekday = weekdayOf(key);
    if (weekday === 0 || weekday === 6 || holidays.has(key)) continue;
    for (const session of WORKING_SESSIONS) {
      const a = Math.max(from, day + session.startMinute * 60000);
      const b = Math.min(to, day + session.endMinute * 60000);
      if (b > a) working.push([a, b]);
    }
  }

  const paused = mergeSegments(
    pauses.map((p): Segment => [Math.max(from, p.start.getTime()), Math.min(to, (p.end ?? end).getTime())]),
  );

  let total = 0;
  for (const [a, b] of working) {
    let remaining = b - a;
    for (const [pa, pb] of paused) {
      const overlap = Math.min(b, pb) - Math.max(a, pa);
      if (overlap > 0) remaining -= overlap;
    }
    total += remaining;
  }
  return total;
}

/** Như `workingMillisBetween` nhưng trả về số giờ (có phần thập phân). */
export function workingHoursBetween(start: Date, end: Date, calendar: SlaCalendar, pauses: ReadonlyArray<PauseInterval> = []): number {
  return workingMillisBetween(start, end, calendar, pauses) / HOUR_MS;
}
