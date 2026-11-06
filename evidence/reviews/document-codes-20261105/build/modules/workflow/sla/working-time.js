"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarCoverageError = exports.SIMULATED_CALENDAR_V1 = exports.WORKING_SESSIONS = void 0;
exports.workingMillisBetween = workingMillisBetween;
exports.workingHoursBetween = workingHoursBetween;
const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;
const VN_OFFSET_MS = 7 * HOUR_MS;
exports.WORKING_SESSIONS = [
    { startMinute: 8 * 60, endMinute: 12 * 60 },
    { startMinute: 13 * 60, endMinute: 17 * 60 },
];
exports.SIMULATED_CALENDAR_V1 = {
    version: 'SIM-20261026-20261108-v1',
    coverageFrom: '2026-10-26',
    coverageTo: '2026-11-08',
    holidays: ['2026-10-30'],
};
class CalendarCoverageError extends Error {
    calendarVersion;
    dateKey;
    constructor(calendarVersion, dateKey) {
        super(`Lịch SLA ${calendarVersion} không bao phủ ngày ${dateKey}. Cần trình lịch kế tiếp trước khi tính.`);
        this.calendarVersion = calendarVersion;
        this.dateKey = dateKey;
        this.name = 'CalendarCoverageError';
    }
}
exports.CalendarCoverageError = CalendarCoverageError;
const dateKeyOf = (ms) => new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
const midnightUtcMs = (dateKey) => Date.parse(`${dateKey}T00:00:00Z`) - VN_OFFSET_MS;
const weekdayOf = (dateKey) => new Date(`${dateKey}T00:00:00Z`).getUTCDay();
function mergeSegments(segments) {
    const sorted = segments.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
    const merged = [];
    for (const [a, b] of sorted) {
        const last = merged[merged.length - 1];
        if (last && a <= last[1])
            last[1] = Math.max(last[1], b);
        else
            merged.push([a, b]);
    }
    return merged;
}
function assertCovered(calendar, ms) {
    const key = dateKeyOf(ms);
    if (key < calendar.coverageFrom || key > calendar.coverageTo)
        throw new CalendarCoverageError(calendar.version, key);
}
function workingMillisBetween(start, end, calendar, pauses = []) {
    const from = start.getTime();
    const to = end.getTime();
    if (!(to > from))
        return 0;
    assertCovered(calendar, from);
    assertCovered(calendar, to);
    const holidays = new Set(calendar.holidays);
    const working = [];
    for (let day = midnightUtcMs(dateKeyOf(from)); day <= to; day += DAY_MS) {
        const key = dateKeyOf(day);
        const weekday = weekdayOf(key);
        if (weekday === 0 || weekday === 6 || holidays.has(key))
            continue;
        for (const session of exports.WORKING_SESSIONS) {
            const a = Math.max(from, day + session.startMinute * 60000);
            const b = Math.min(to, day + session.endMinute * 60000);
            if (b > a)
                working.push([a, b]);
        }
    }
    const paused = mergeSegments(pauses.map((p) => [Math.max(from, p.start.getTime()), Math.min(to, (p.end ?? end).getTime())]));
    let total = 0;
    for (const [a, b] of working) {
        let remaining = b - a;
        for (const [pa, pb] of paused) {
            const overlap = Math.min(b, pb) - Math.max(a, pa);
            if (overlap > 0)
                remaining -= overlap;
        }
        total += remaining;
    }
    return total;
}
function workingHoursBetween(start, end, calendar, pauses = []) {
    return workingMillisBetween(start, end, calendar, pauses) / HOUR_MS;
}
//# sourceMappingURL=working-time.js.map