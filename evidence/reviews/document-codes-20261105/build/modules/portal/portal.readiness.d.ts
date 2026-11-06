export declare const mvpPolicy: {
    version: string;
    status: string;
    canSubmit: boolean;
    scope: string;
    decisions: {
        id: string;
        status: string;
        rule: string;
    }[];
};
type FileBasis = {
    id: string;
    documentGroup: string;
    coverage?: any;
    withdrawnAt?: unknown;
    supersedesId?: string | null;
};
export declare function assessReadiness(data: Record<string, any>, documents: FileBasis[]): {
    version: string;
    policyVersion: string;
    dataReady: boolean;
    canSubmit: boolean;
    creditDecision: null;
    issues: {
        code: string;
        path: string;
        step: number;
        message: string;
    }[];
    annualSourceIds: string[];
    note: string;
};
export declare function companyReadiness(data: Record<string, any>, company: Record<string, any>): {
    compatible: boolean;
    requiresConfirmation: boolean;
    differences: string[];
    annualPeriod: any;
    message: string;
};
export {};
