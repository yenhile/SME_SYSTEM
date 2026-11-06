export declare const WORKING_SESSIONS: ReadonlyArray<{
    startMinute: number;
    endMinute: number;
}>;
export interface SlaCalendar {
    version: string;
    coverageFrom: string;
    coverageTo: string;
    holidays: ReadonlyArray<string>;
}
export declare const SIMULATED_CALENDAR_V1: SlaCalendar;
export interface PauseInterval {
    start: Date;
    end: Date | null;
}
export declare class CalendarCoverageError extends Error {
    readonly calendarVersion: string;
    readonly dateKey: string;
    constructor(calendarVersion: string, dateKey: string);
}
export declare function workingMillisBetween(start: Date, end: Date, calendar: SlaCalendar, pauses?: ReadonlyArray<PauseInterval>): number;
export declare function workingHoursBetween(start: Date, end: Date, calendar: SlaCalendar, pauses?: ReadonlyArray<PauseInterval>): number;
