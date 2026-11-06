"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OVERDUE_AFTER_DAYS = exports.REMINDER_AFTER_DAYS = void 0;
exports.overdueAt = overdueAt;
exports.reminderAt = reminderAt;
const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
exports.REMINDER_AFTER_DAYS = 5;
exports.OVERDUE_AFTER_DAYS = 10;
function addCalendarDays(from, days) {
    const result = new Date(from.getTime() + days * DAY_MS);
    const weekday = new Date(result.getTime() + VN_OFFSET_MS).getUTCDay();
    if (weekday === 6)
        return new Date(result.getTime() + 2 * DAY_MS);
    if (weekday === 0)
        return new Date(result.getTime() + DAY_MS);
    return result;
}
function overdueAt(requestedAt, deadlineAt) {
    return deadlineAt ?? addCalendarDays(requestedAt, exports.OVERDUE_AFTER_DAYS);
}
function reminderAt(requestedAt, deadlineAt) {
    const at = addCalendarDays(requestedAt, exports.REMINDER_AFTER_DAYS);
    return at.getTime() >= overdueAt(requestedAt, deadlineAt).getTime() ? null : at;
}
//# sourceMappingURL=supplement-deadlines.js.map