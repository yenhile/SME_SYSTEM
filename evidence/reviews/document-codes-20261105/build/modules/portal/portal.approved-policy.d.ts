import { type FinancialComponent } from './portal.foundation';
import { type PolicyDocument, type PolicyRequirement, type PortalPolicy } from './portal.policy';
export declare const APPROVED_MVP_POLICY_VERSION = "sme-mvp-manufacturing-working-capital-2026-10-26-v1";
export declare const REPRESENTATIVE_DECLARATION_VERSION = "portal-enterprise-submission-v1";
interface IntakeRequirement extends PolicyRequirement {
    label: string;
    guidance: string;
    reviewCriteria: string[];
    step: 4;
}
export interface ApprovedPortalPolicy extends PortalPolicy {
    status: 'APPROVED';
    scope: string;
    annualPeriodRule: 'PREVIOUS_COMPLETED_CALENDAR_YEAR';
    timezone: 'Asia/Ho_Chi_Minh';
    declaration: {
        version: string;
        text: string;
    };
    requirements: IntakeRequirement[];
}
export declare function getApprovedPolicy(version?: string): ApprovedPortalPolicy;
export declare function describeApprovedPolicy(): {
    policy: ApprovedPortalPolicy;
    canSubmit: false;
    canAccept: false;
    activationStatus: "IMPLEMENTATION_INCOMPLETE";
    note: string;
};
export declare const SCOPE_POLICY_VERSIONS: Record<string, string>;
export declare function isApprovedIntakeVersion(version: string): boolean;
export declare function getPolicyForScope(scope: string): ApprovedPortalPolicy;
export declare function evaluateIntakeReadiness(policy: ApprovedPortalPolicy, data: unknown, documents: PolicyDocument[], options: {
    phase: 'SUBMIT' | 'INTAKE';
    submittedAt: Date | string;
}): {
    policyVersion: string;
    annualPeriod: string;
    phase: "SUBMIT" | "INTAKE";
    missingFields: string[];
    missingDocuments: string[];
    formErrors: string[];
    issues: {
        code: string;
        path: string;
        step: number;
        message: string;
    }[];
    requirements: {
        state: "MISSING" | "LATER" | "NOT_APPLICABLE" | "PROVIDED_PENDING_REVIEW";
        label: string;
        guidance: string;
        reviewCriteria: string[];
        step: 4;
        id: string;
        group: string;
        documentTypeCode: string;
        required: boolean;
        stage: "SUBMIT" | "INTAKE" | "LATER";
        periods?: string[];
        condition?: {
            field: string;
            equals: string | boolean;
        };
        alternatives?: string[];
        deferred?: boolean;
        basis?: string;
        component?: FinancialComponent;
        applies: boolean;
        due: boolean;
        satisfied: boolean;
    }[];
    dataReady: boolean;
    canSubmit: false;
    canAccept: false;
    businessValidity: "NOT_REVIEWED";
    creditDecision: null;
    note: string;
};
export {};
