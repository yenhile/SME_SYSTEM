export declare const REPORT_FIELDS: readonly ["legalAssessment", "businessAssessment", "financialAssessment", "repaymentSource", "collateralAssessment", "risks", "recommendation", "proposedConditions"];
export declare function validateReport(value: unknown, complete?: boolean): Record<string, string>;
export declare const digest: (value: unknown) => string;
export declare function reportEvidence(tx: any, loan: any): Promise<any>;
export declare function assertIndependent(tx: any, loan: any, user: {
    id: string;
}): Promise<void>;
export declare function assertReportDecision(tx: any, loan: any, user: {
    id: string;
}, versionId?: string): Promise<{
    report: any;
    version: any;
}>;
