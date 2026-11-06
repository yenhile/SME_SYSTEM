import { type FinancialComponent } from './portal.foundation';
export interface PolicyRequirement {
    id: string;
    group: string;
    documentTypeCode: string;
    required: boolean;
    stage: 'SUBMIT' | 'INTAKE' | 'LATER';
    periods?: string[];
    condition?: {
        field: string;
        equals: string | boolean;
    };
    alternatives?: string[];
    deferred?: boolean;
    basis?: string;
    component?: FinancialComponent;
}
export interface PortalPolicy {
    readinessVersion?: 'MVP1';
    version: string;
    status: 'APPROVED' | 'TEST_ONLY';
    formVersion: 2;
    requiredFields: string[];
    requirements: PolicyRequirement[];
}
export interface PortalPolicyContext {
    mode: 'isolated-test';
    policy: PortalPolicy;
}
export type PolicyDocument = {
    id: string;
    documentGroup: string;
    coverage?: unknown;
    withdrawnAt?: unknown;
    supersedesId?: string | null;
};
export type ResolvedPolicyRequirement = PolicyRequirement & {
    applies: boolean;
    due: boolean;
    satisfied: boolean;
};
export declare function evaluatePolicy(policy: PortalPolicy, data: unknown, documents: PolicyDocument[], phase: 'SUBMIT' | 'INTAKE'): {
    requirements: ResolvedPolicyRequirement[];
    missing: string[];
    formErrors: string[];
};
export declare function resolveTestPolicy(context?: PortalPolicyContext): PortalPolicy;
