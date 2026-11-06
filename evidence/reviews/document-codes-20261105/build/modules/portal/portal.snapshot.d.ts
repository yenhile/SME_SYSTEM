import type { PortalPolicy, ResolvedPolicyRequirement } from './portal.policy';
export declare function sameJson(a: unknown, b: unknown): boolean;
export type SnapshotDocument = {
    id: string;
    documentGroup: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
    coverage: any;
    version: number;
    contentHash: string | null;
    sha256: string;
};
export type SubmissionSnapshot = {
    snapshotVersion: 2;
    requestId: string;
    formVersion: 2;
    checklistVersion: string;
    revision: number;
    submittedAt: string;
    data: any;
    policy: PortalPolicy;
    checklist: ResolvedPolicyRequirement[];
    documents: SnapshotDocument[];
    audit: {
        event: string;
        actorAccountId: string;
        requestId: string;
        at: string;
    };
    integrity: string;
};
export declare function createV2Snapshot(request: any, policy: PortalPolicy, checklist: ResolvedPolicyRequirement[], documents: any[], now: Date): SubmissionSnapshot;
export declare function readV2Snapshot(request: any): SubmissionSnapshot;
