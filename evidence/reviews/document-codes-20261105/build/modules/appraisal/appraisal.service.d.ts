import { PrismaService } from '../../prisma.service';
import { WorkflowService } from '../workflow/workflow.service';
import { PredictionService } from '../prediction/prediction.service';
import { LoanActor } from '../workflow/loan-policy';
export declare class AppraisalService {
    private prisma;
    private workflow;
    private prediction;
    constructor(prisma: PrismaService, workflow: WorkflowService, prediction: PredictionService);
    view(id: string, actor?: {
        id: string;
        activeRole?: string;
    }): Promise<({
        versions: {
            id: string;
            submittedAt: Date;
            sequence: number;
            reportId: string;
            content: import("@prisma/client/runtime/library").JsonValue;
            evidence: import("@prisma/client/runtime/library").JsonValue;
            evidenceHash: string;
            submittedBy: string;
        }[];
        events: {
            id: string;
            createdAt: Date;
            reportId: string;
            actorId: string;
            kind: string;
            clientRequestId: string;
            payloadHash: string;
            payload: import("@prisma/client/runtime/library").JsonValue;
        }[];
    } & {
        id: string;
        applicationId: string;
        draft: import("@prisma/client/runtime/library").JsonValue;
        status: string;
        revision: number;
        clarification: import("@prisma/client/runtime/library").JsonValue | null;
        decidedVersionId: string | null;
    }) | {
        makerChecker: {
            isIndependent: boolean;
            canClarify: boolean;
            clarifyBlockReason: string | null;
        };
        versions: {
            id: string;
            submittedAt: Date;
            sequence: number;
            reportId: string;
            content: import("@prisma/client/runtime/library").JsonValue;
            evidence: import("@prisma/client/runtime/library").JsonValue;
            evidenceHash: string;
            submittedBy: string;
        }[];
        events: {
            id: string;
            createdAt: Date;
            reportId: string;
            actorId: string;
            kind: string;
            clientRequestId: string;
            payloadHash: string;
            payload: import("@prisma/client/runtime/library").JsonValue;
        }[];
        id: string;
        applicationId: string;
        draft: import("@prisma/client/runtime/library").JsonValue;
        status: string;
        revision: number;
        clarification: import("@prisma/client/runtime/library").JsonValue | null;
        decidedVersionId: string | null;
    } | null>;
    private body;
    mutate(id: string, kind: 'DRAFT_SAVED' | 'SUBMITTED' | 'CLARIFICATION_REQUESTED', body: any, user: LoanActor): Promise<({
        versions: {
            id: string;
            submittedAt: Date;
            sequence: number;
            reportId: string;
            content: import("@prisma/client/runtime/library").JsonValue;
            evidence: import("@prisma/client/runtime/library").JsonValue;
            evidenceHash: string;
            submittedBy: string;
        }[];
        events: {
            id: string;
            createdAt: Date;
            reportId: string;
            actorId: string;
            kind: string;
            clientRequestId: string;
            payloadHash: string;
            payload: import("@prisma/client/runtime/library").JsonValue;
        }[];
    } & {
        id: string;
        applicationId: string;
        draft: import("@prisma/client/runtime/library").JsonValue;
        status: string;
        revision: number;
        clarification: import("@prisma/client/runtime/library").JsonValue | null;
        decidedVersionId: string | null;
    }) | {
        makerChecker: {
            isIndependent: boolean;
            canClarify: boolean;
            clarifyBlockReason: string | null;
        };
        versions: {
            id: string;
            submittedAt: Date;
            sequence: number;
            reportId: string;
            content: import("@prisma/client/runtime/library").JsonValue;
            evidence: import("@prisma/client/runtime/library").JsonValue;
            evidenceHash: string;
            submittedBy: string;
        }[];
        events: {
            id: string;
            createdAt: Date;
            reportId: string;
            actorId: string;
            kind: string;
            clientRequestId: string;
            payloadHash: string;
            payload: import("@prisma/client/runtime/library").JsonValue;
        }[];
        id: string;
        applicationId: string;
        draft: import("@prisma/client/runtime/library").JsonValue;
        status: string;
        revision: number;
        clarification: import("@prisma/client/runtime/library").JsonValue | null;
        decidedVersionId: string | null;
    } | null>;
}
