const DAY_MS = 24 * 60 * 60 * 1000;
// Việt Nam là UTC+7, không có giờ mùa hè.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export const REMINDER_AFTER_DAYS = 5;
export const OVERDUE_AFTER_DAYS = 10;

/** Cộng ngày lịch; mốc rơi vào Thứ Bảy/Chủ nhật (giờ Việt Nam) thì lùi sang Thứ Hai, giữ nguyên giờ trong ngày. */
function addCalendarDays(from: Date, days: number): Date {
  const result = new Date(from.getTime() + days * DAY_MS);
  const weekday = new Date(result.getTime() + VN_OFFSET_MS).getUTCDay();
  if (weekday === 6) return new Date(result.getTime() + 2 * DAY_MS);
  if (weekday === 0) return new Date(result.getTime() + DAY_MS);
  return result;
}

/** Mốc quá hạn: hạn CBTD nhập (deadlineAt) nếu có, ngược lại ngày 10 kể từ lúc tạo yêu cầu. */
export function overdueAt(requestedAt: Date, deadlineAt?: Date | null): Date {
  return deadlineAt ?? addCalendarDays(requestedAt, OVERDUE_AFTER_DAYS);
}

/** Mốc nhắc ngày 5; null khi hạn đến sớm hơn mốc nhắc. */
export function reminderAt(requestedAt: Date, deadlineAt?: Date | null): Date | null {
  const at = addCalendarDays(requestedAt, REMINDER_AFTER_DAYS);
  return at.getTime() >= overdueAt(requestedAt, deadlineAt).getTime() ? null : at;
}
