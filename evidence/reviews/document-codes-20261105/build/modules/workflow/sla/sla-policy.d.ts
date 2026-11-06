import { PauseInterval, SlaCalendar } from './working-time';
export declare const SLA_POLICY_PA1 = "PA1";
export declare function calendarByVersion(version: string): SlaCalendar;
export interface StageSlaMode {
    slaPolicy: string | null;
    slaCalendarVersion: string | null;
}
export declare const LEGACY_SLA: StageSlaMode;
interface ActivationReader {
    slaPolicyActivation: {
        findFirst(args: any): Promise<{
            policyCode: string;
            calendarVersion: string;
            activatedAt: Date;
        } | null>;
    };
}
export declare function resolveStageSla(db: ActivationReader, now: Date, requireCoverage?: boolean): Promise<StageSlaMode>;
interface PauseReader {
    applicationStagePause: {
        findMany(args: any): Promise<Array<{
            startedAt: Date;
            endedAt: Date | null;
        }>>;
    };
}
export declare function loadPauseIntervals(db: PauseReader, historyId: string, slaPolicy: string | null): Promise<PauseInterval[]>;
interface PauseWriter {
    applicationStageHistory: {
        findFirst(args: any): Promise<any>;
        update(args: any): Promise<any>;
    };
    applicationStagePause: {
        findFirst(args: any): Promise<any>;
        create(args: any): Promise<any>;
        updateMany(args: any): Promise<{
            count: number;
        }>;
    };
}
export declare function openStagePause(db: PauseWriter, applicationId: string, at: Date, reason: string, supplementId?: string): Promise<boolean>;
export declare function closeStagePause(db: PauseWriter, applicationId: string, at: Date): Promise<boolean>;
export interface StageClosingInput {
    enteredAt: Date;
    pausedAt: Date | null;
    pausedDurationHours: number;
    slaStandardHours: number;
    slaPolicy: string | null;
    slaCalendarVersion: string | null;
}
export interface StageClosingResult {
    actualDurationHours: number;
    pausedDurationHours: number;
    netWorkDurationHours: number;
    isDelayed: boolean;
}
export declare function computeStageClosing(stage: StageClosingInput, pauses: ReadonlyArray<PauseInterval>, exitedAt: Date): StageClosingResult;
export {};
