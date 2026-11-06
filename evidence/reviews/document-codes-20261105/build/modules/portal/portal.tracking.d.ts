export declare const PUBLIC_REJECTION_REASONS: Record<string, string>;
export declare const GENERIC_REJECTION = "H\u1ED3 s\u01A1 kh\u00F4ng \u0111\u01B0\u1EE3c ch\u1EA5p thu\u1EADn";
export declare const PUBLIC_REJECTION_CODES: readonly ["TC01", "TC02", "TC03", "TC04", "TC05"];
export type PublicRejectionReasonCode = (typeof PUBLIC_REJECTION_CODES)[number];
export declare function isPublicRejectionReasonCode(code: unknown): code is PublicRejectionReasonCode;
export type StepState = 'done' | 'current' | 'pending' | 'stopped';
export interface TrackingLoan {
    currentStage: string;
    currentStatus: string;
    completedAt?: Date | null;
    rejectionReasonCode?: string | null;
    stageHistories?: {
        stage: {
            stageCode: string;
        };
    }[];
}
export interface TrackingRequest {
    id: string;
    reference: string;
    status: string;
    submittedAt?: Date | null;
    acceptedAt?: Date | null;
}
export declare function buildTracking(request: TrackingRequest, loan?: TrackingLoan | null): any;
