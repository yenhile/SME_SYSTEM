"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_SLA = exports.SLA_POLICY_PA1 = void 0;
exports.calendarByVersion = calendarByVersion;
exports.resolveStageSla = resolveStageSla;
exports.loadPauseIntervals = loadPauseIntervals;
exports.openStagePause = openStagePause;
exports.closeStagePause = closeStagePause;
exports.computeStageClosing = computeStageClosing;
const common_1 = require("@nestjs/common");
const working_time_1 = require("./working-time");
exports.SLA_POLICY_PA1 = 'PA1';
const CALENDARS = {
    [working_time_1.SIMULATED_CALENDAR_V1.version]: working_time_1.SIMULATED_CALENDAR_V1,
};
function calendarByVersion(version) {
    const calendar = CALENDARS[version];
    if (!calendar)
        throw new common_1.BadRequestException(`Không tìm thấy phiên bản lịch SLA ${version}.`);
    return calendar;
}
exports.LEGACY_SLA = { slaPolicy: null, slaCalendarVersion: null };
async function resolveStageSla(db, now, requireCoverage = true) {
    const activation = await db.slaPolicyActivation.findFirst({ where: { activatedAt: { lte: now } }, orderBy: { activatedAt: 'desc' } });
    if (!activation || activation.policyCode !== exports.SLA_POLICY_PA1)
        return exports.LEGACY_SLA;
    const calendar = calendarByVersion(activation.calendarVersion);
    if (requireCoverage) {
        try {
            (0, working_time_1.workingMillisBetween)(now, new Date(now.getTime() + 1), calendar);
        }
        catch (error) {
            if (error instanceof working_time_1.CalendarCoverageError)
                throw new common_1.BadRequestException(error.message);
            throw error;
        }
    }
    return { slaPolicy: exports.SLA_POLICY_PA1, slaCalendarVersion: activation.calendarVersion };
}
async function loadPauseIntervals(db, historyId, slaPolicy) {
    if (slaPolicy !== exports.SLA_POLICY_PA1)
        return [];
    const rows = await db.applicationStagePause.findMany({ where: { historyId }, orderBy: { startedAt: 'asc' } });
    return rows.map(row => ({ start: row.startedAt, end: row.endedAt }));
}
async function openStageOf(db, applicationId) {
    return db.applicationStageHistory.findFirst({ where: { applicationId, exitedAt: null }, orderBy: { enteredAt: 'desc' } });
}
async function openStagePause(db, applicationId, at, reason, supplementId) {
    const stage = await openStageOf(db, applicationId);
    if (!stage || stage.slaPolicy !== exports.SLA_POLICY_PA1)
        return false;
    if (await db.applicationStagePause.findFirst({ where: { historyId: stage.id, endedAt: null } }))
        return false;
    await db.applicationStagePause.create({ data: { historyId: stage.id, startedAt: at, reason, supplementId: supplementId ?? null } });
    await db.applicationStageHistory.update({ where: { id: stage.id }, data: { pausedAt: at } });
    return true;
}
async function closeStagePause(db, applicationId, at) {
    const stage = await openStageOf(db, applicationId);
    if (!stage || stage.slaPolicy !== exports.SLA_POLICY_PA1)
        return false;
    const closed = await db.applicationStagePause.updateMany({ where: { historyId: stage.id, endedAt: null }, data: { endedAt: at } });
    if (closed.count > 0)
        await db.applicationStageHistory.update({ where: { id: stage.id }, data: { pausedAt: null } });
    return closed.count > 0;
}
function computeStageClosing(stage, pauses, exitedAt) {
    if (stage.slaPolicy === exports.SLA_POLICY_PA1) {
        const calendar = calendarByVersion(stage.slaCalendarVersion ?? '');
        let actual;
        let net;
        try {
            actual = (0, working_time_1.workingHoursBetween)(stage.enteredAt, exitedAt, calendar);
            net = (0, working_time_1.workingHoursBetween)(stage.enteredAt, exitedAt, calendar, pauses);
        }
        catch (error) {
            if (error instanceof working_time_1.CalendarCoverageError)
                throw new common_1.BadRequestException(error.message);
            throw error;
        }
        return { actualDurationHours: actual, pausedDurationHours: actual - net, netWorkDurationHours: net, isDelayed: net > stage.slaStandardHours };
    }
    const pausedNow = stage.pausedAt ? (exitedAt.getTime() - stage.pausedAt.getTime()) / 3600000 : 0;
    const pausedTotal = stage.pausedDurationHours + pausedNow;
    const actual = (exitedAt.getTime() - stage.enteredAt.getTime()) / 3600000;
    const net = Math.max(0, actual - pausedTotal);
    return { actualDurationHours: actual, pausedDurationHours: pausedTotal, netWorkDurationHours: net, isDelayed: net > stage.slaStandardHours };
}
//# sourceMappingURL=sla-policy.js.map