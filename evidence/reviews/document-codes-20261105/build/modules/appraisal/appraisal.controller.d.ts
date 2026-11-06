import { Response } from 'express';
import { LoanActor } from '../workflow/loan-policy';
import { AppraisalService } from './appraisal.service';
export declare class AppraisalController {
    private service;
    constructor(service: AppraisalService);
    view(id: string, res: Response, user?: any): Promise<({
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
    }) | undefined>;
    save(id: string, body: any, user: LoanActor): Promise<({
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
    submit(id: string, body: any, user: LoanActor): Promise<({
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
    clarify(id: string, body: any, user: LoanActor): Promise<({
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
