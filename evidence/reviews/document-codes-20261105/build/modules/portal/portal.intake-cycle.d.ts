import { type SubmissionSnapshot } from './portal.snapshot';
export type ReviewItem = {
    id: string;
    label: string;
    group: string;
    documentIds: string[];
    fingerprint: string;
    guidance?: string;
    reviewCriteria?: string[];
};
export type IntakeReview = ReviewItem & {
    decision: 'ACCEPTED' | 'NEEDS_CORRECTION';
    message: string;
    reviewerId: string;
    reviewedAt: string;
    carriedFrom?: string;
};
export declare const intakeCycleEnabled: () => boolean;
export declare const isIntakeEditable: (r: {
    formVersion?: number;
    status: string;
}) => boolean;
export declare const hasPendingCorrection: (value: any) => boolean;
export declare const intakeDigest: (value: unknown) => string;
export declare function intakeChecklist(snapshot: Pick<SubmissionSnapshot, 'data' | 'documents' | 'checklist'>): ReviewItem[];
export declare function carryReviews(previous: IntakeReview[], next: ReviewItem[], submissionId?: string): IntakeReview[];
export declare function assertReviewsComplete(items: ReviewItem[], reviews: IntakeReview[]): void;
export declare function submissionChanges(previous: Pick<SubmissionSnapshot, 'data' | 'documents'> | null, next: Pick<SubmissionSnapshot, 'data' | 'documents'>): {
    fields: string[];
    addedDocuments: string[];
    removedDocuments: string[];
};
export declare function approvedCompanyDifferences(data: Record<string, any>, company: Record<string, any>): string[];
