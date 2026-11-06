export declare const LEGACY_CHECKLIST_VERSION = "legacy-v1";
export declare const PREVIEW_CHECKLIST_VERSION = "sme-preview-v2";
export declare const FINANCIAL_COMPONENTS: readonly ["BALANCE_SHEET", "INCOME_STATEMENT", "CASH_FLOW_STATEMENT", "NOTES"];
export type FinancialComponent = typeof FINANCIAL_COMPONENTS[number];
export type DocumentCoverage = {
    documentTypeCode: string;
    period?: string;
    components?: FinancialComponent[];
};
export declare const PORTAL_CORE_FIELDS: string[];
export declare function assertPreviewEnabled(): void;
export declare function validateDraftV2(input: unknown): Record<string, any>;
export declare function validateCoverage(group: string, input: unknown): DocumentCoverage[];
export declare function getFormConfig(): {
    formVersion: number;
    previewEnabled: boolean;
    technicalLimits: {
        maxFileBytes: number;
        maxActiveFiles: number;
    };
    checklistVersion: string;
    legacyChecklistVersion: string;
    policyStatus: string;
    canSubmit: boolean;
    groups: {
        code: string;
        name: string;
        policyStatus: string;
        documentTypes: {
            code: string;
            name: string;
            purpose: string;
            formats: string[];
            group: string;
            description: string;
            ruleVersion: string;
            alternatives: never[];
            nonApplicabilityBasis: string;
            deferralBasis: string;
            policyStatus: string;
            requiredness: string;
            stage: string;
            applicability: string;
            versionRule: string;
            sendRule: string;
            periodRequirement: string;
            deferralStatus: string;
            substituteStatus: string;
        }[];
    }[];
};
type ChecklistDocument = {
    id: string;
    documentGroup: string;
    coverage?: unknown;
    supersedesId?: string | null;
    withdrawnAt?: unknown;
};
type ChecklistRequest = {
    formVersion?: number;
    checklistVersion?: string;
    documents?: ChecklistDocument[];
};
export declare function checklistFor(request: ChecklistRequest): {
    formVersion: number;
    checklistVersion: string;
    policyStatus: string;
    cannotSubmit: boolean;
    groups: {
        code: string;
        name: string;
        required: boolean | null;
        status: string;
        documents: {
            id: string;
            coverage: {} | null;
        }[];
    }[];
};
export {};
