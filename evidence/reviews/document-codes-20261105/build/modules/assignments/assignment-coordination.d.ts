export declare const COORDINATION_REASONS: readonly ["WORKLOAD", "UNAVAILABLE", "ASSIGNMENT_MISMATCH", "CONFLICT_OF_INTEREST", "OTHER"];
export type AssignmentSubject = {
    applicationId?: string;
    portalRequestId?: string;
};
export declare function assertNoCoordinationConflict(tx: any, subject: AssignmentSubject, actorId: string, decision?: boolean): Promise<void>;
export declare function lockCoordinationCompany(tx: any, actorId: string, taxCode: string): Promise<void>;
export declare function assertNoCompanyConflict(tx: any, actorId: string, taxCode: string): Promise<void>;
export declare function obsoleteCoordination(tx: any, subject: AssignmentSubject, resolutionCode: string, excludeId?: string): Promise<void>;
