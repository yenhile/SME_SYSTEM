import { PrismaService } from '../../prisma.service';
import { Prisma } from '@prisma/client';
import { PortalFile } from './portal.validation';
import { type PortalPolicyContext } from './portal.policy';
export declare class PortalService {
    private prisma;
    private policyContext?;
    private readonly dir;
    constructor(prisma: PrismaService, policyContext?: PortalPolicyContext | undefined);
    private cycle;
    private usesCycle;
    private published;
    private companyComparison;
    formConfig(): {
        canSubmit: boolean;
        canAccept: boolean;
        intakeCycleEnabled: boolean;
        submitPolicyVersion: string;
        policyStatus: string;
        approvedIntakePolicy: {
            policy: import("./portal.approved-policy").ApprovedPortalPolicy;
            canSubmit: boolean;
            canAccept: boolean;
            activationStatus: string;
            note: string;
        };
        rolloutEnabled: boolean;
        branchLimit: number;
        supportedScopes: string[];
        supportedLoanTypes: string[];
        mvpPolicy: {
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
        formVersion: number;
        previewEnabled: boolean;
        technicalLimits: {
            maxFileBytes: number;
            maxActiveFiles: number;
        };
        checklistVersion: string;
        legacyChecklistVersion: string;
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
    } | {
        canSubmit: boolean;
        canAccept: boolean;
        submitPolicyVersion: string;
        readinessVersion: "MVP1" | undefined;
        policyStatus: string;
        rolloutEnabled: boolean;
        branchLimit: number;
        supportedScopes: string[];
        supportedLoanTypes: string[];
        mvpPolicy: {
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
        approvedIntakePolicy: {
            policy: import("./portal.approved-policy").ApprovedPortalPolicy;
            canSubmit: false;
            canAccept: false;
            activationStatus: "IMPLEMENTATION_INCOMPLETE";
            note: string;
        };
        formVersion: number;
        previewEnabled: boolean;
        technicalLimits: {
            maxFileBytes: number;
            maxActiveFiles: number;
        };
        checklistVersion: string;
        legacyChecklistVersion: string;
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
    } | {
        canAccept: boolean;
        submitPolicyVersion: null;
        rolloutEnabled: boolean;
        branchLimit: number;
        supportedScopes: string[];
        supportedLoanTypes: string[];
        mvpPolicy: {
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
        approvedIntakePolicy: {
            policy: import("./portal.approved-policy").ApprovedPortalPolicy;
            canSubmit: false;
            canAccept: false;
            activationStatus: "IMPLEMENTATION_INCOMPLETE";
            note: string;
        };
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
    checklist(id: string, accountId: string): Promise<{
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
    } | {
        policyStatus: string;
        cannotSubmit: boolean;
        requirements: import("./portal.policy").ResolvedPolicyRequirement[];
        missing: string[];
        formErrors: string[];
        submitPolicyVersion: string;
        approvedIntakeAssessment: {
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
                component?: import("./portal.foundation").FinancialComponent;
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
        } | {
            policyVersion: string;
            dataReady: boolean;
            canSubmit: boolean;
            canAccept: boolean;
            businessValidity: string;
            creditDecision: null;
            missingFields: never[];
            missingDocuments: never[];
            requirements: never[];
            formErrors: string[];
            issues: {
                code: string;
                path: string;
                step: number;
                message: string;
            }[];
            note: string;
        } | null;
        formVersion: number;
        checklistVersion: string;
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
    }>;
    private approvedAssessment;
    private body;
    private revision;
    private legacyOnly;
    private intakeScope;
    private internalPublished;
    list(accountId?: string, user?: {
        id: string;
        roles: string[];
    }): Promise<any[] | ({
        documents: {
            id: string;
            version: number;
            coverage: Prisma.JsonValue;
            documentGroup: string;
            fileName: string;
            fileSize: number;
            supersedesId: string | null;
            uploadedAt: Date;
            withdrawnAt: Date | null;
        }[];
        account: {
            id: string;
            phone: string;
            contactName: string;
            email: string;
        };
        assignedOfficer: {
            id: string;
            username: string;
            fullName: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        data: Prisma.JsonValue;
        updatedAt: Date;
        assignedTo: string | null;
        assignmentVersion: number;
        status: import(".prisma/client").$Enums.PortalRequestStatus;
        submittedAt: Date | null;
        revision: number;
        assignedAt: Date | null;
        reference: string;
        accountId: string;
        formVersion: number;
        checklistVersion: string;
        checklistSnapshot: Prisma.JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: Prisma.JsonValue | null;
        correctionHistory: Prisma.JsonValue;
    })[]>;
    private internalCoordinationView;
    one(id: string, accountId?: string, user?: {
        id: string;
        roles: string[];
    }): Promise<any>;
    tracking(id: string, accountId: string): Promise<any>;
    create(accountId: string, body: any): Promise<{
        documents: {
            id: string;
            version: number;
            coverage: Prisma.JsonValue;
            documentGroup: string;
            fileName: string;
            fileSize: number;
            supersedesId: string | null;
            uploadedAt: Date;
            withdrawnAt: Date | null;
        }[];
        account: {
            id: string;
            phone: string;
            contactName: string;
            email: string;
        };
        assignedOfficer: {
            id: string;
            username: string;
            fullName: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        data: Prisma.JsonValue;
        updatedAt: Date;
        assignedTo: string | null;
        assignmentVersion: number;
        status: import(".prisma/client").$Enums.PortalRequestStatus;
        submittedAt: Date | null;
        revision: number;
        assignedAt: Date | null;
        reference: string;
        accountId: string;
        formVersion: number;
        checklistVersion: string;
        checklistSnapshot: Prisma.JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: Prisma.JsonValue | null;
        correctionHistory: Prisma.JsonValue;
    }>;
    private locked;
    private draft;
    update(id: string, accountId: string, body: any): Promise<{
        documents: {
            id: string;
            version: number;
            coverage: Prisma.JsonValue;
            documentGroup: string;
            fileName: string;
            fileSize: number;
            supersedesId: string | null;
            uploadedAt: Date;
            withdrawnAt: Date | null;
        }[];
        account: {
            id: string;
            phone: string;
            contactName: string;
            email: string;
        };
        assignedOfficer: {
            id: string;
            username: string;
            fullName: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        data: Prisma.JsonValue;
        updatedAt: Date;
        assignedTo: string | null;
        assignmentVersion: number;
        status: import(".prisma/client").$Enums.PortalRequestStatus;
        submittedAt: Date | null;
        revision: number;
        assignedAt: Date | null;
        reference: string;
        accountId: string;
        formVersion: number;
        checklistVersion: string;
        checklistSnapshot: Prisma.JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: Prisma.JsonValue | null;
        correctionHistory: Prisma.JsonValue;
    }>;
    upload(id: string, accountId: string, group: string, file: PortalFile, options?: any, supersedesId?: string): Promise<{
        documents: {
            id: string;
            version: number;
            coverage: Prisma.JsonValue;
            documentGroup: string;
            fileName: string;
            fileSize: number;
            supersedesId: string | null;
            uploadedAt: Date;
            withdrawnAt: Date | null;
        }[];
        account: {
            id: string;
            phone: string;
            contactName: string;
            email: string;
        };
        assignedOfficer: {
            id: string;
            username: string;
            fullName: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        data: Prisma.JsonValue;
        updatedAt: Date;
        assignedTo: string | null;
        assignmentVersion: number;
        status: import(".prisma/client").$Enums.PortalRequestStatus;
        submittedAt: Date | null;
        revision: number;
        assignedAt: Date | null;
        reference: string;
        accountId: string;
        formVersion: number;
        checklistVersion: string;
        checklistSnapshot: Prisma.JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: Prisma.JsonValue | null;
        correctionHistory: Prisma.JsonValue;
    }>;
    deleteDocument(id: string, accountId: string, documentId: string, expectedRevision?: number): Promise<{
        documents: {
            id: string;
            version: number;
            coverage: Prisma.JsonValue;
            documentGroup: string;
            fileName: string;
            fileSize: number;
            supersedesId: string | null;
            uploadedAt: Date;
            withdrawnAt: Date | null;
        }[];
        account: {
            id: string;
            phone: string;
            contactName: string;
            email: string;
        };
        assignedOfficer: {
            id: string;
            username: string;
            fullName: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        data: Prisma.JsonValue;
        updatedAt: Date;
        assignedTo: string | null;
        assignmentVersion: number;
        status: import(".prisma/client").$Enums.PortalRequestStatus;
        submittedAt: Date | null;
        revision: number;
        assignedAt: Date | null;
        reference: string;
        accountId: string;
        formVersion: number;
        checklistVersion: string;
        checklistSnapshot: Prisma.JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: Prisma.JsonValue | null;
        correctionHistory: Prisma.JsonValue;
    }>;
    documentVersions(id: string, accountId: string, documentId: string): Promise<{
        id: string;
        version: number;
        coverage: Prisma.JsonValue;
        documentGroup: string;
        fileName: string;
        fileSize: number;
        supersedesId: string | null;
        uploadedAt: Date;
        withdrawnAt: Date | null;
    }[]>;
    documentHeads(id: string, accountId: string): Promise<{
        id: string;
        version: number;
        coverage: Prisma.JsonValue;
        documentGroup: string;
        fileName: string;
        fileSize: number;
        supersedesId: string | null;
        uploadedAt: Date;
        withdrawnAt: Date | null;
    }[]>;
    download(id: string, documentId: string, accountId?: string, user?: {
        id: string;
        roles: string[];
    }): Promise<{
        buffer: Buffer<ArrayBufferLike>;
        fileName: string;
    }>;
    private physicalFiles;
    private submitManifest;
    submit(id: string, accountId: string, body?: any): Promise<any>;
    companyMatch(id: string, user?: {
        id: string;
        roles: string[];
    }): Promise<{
        financialReadiness?: {
            compatible: boolean;
            requiresConfirmation: boolean;
            differences: string[];
            annualPeriod: any;
            message: string;
        } | undefined;
        found: boolean;
        company: {
            id: string;
            createdAt: Date;
            taxCode: string;
            companyName: string;
            industry: string;
            establishedYear: number;
            annualRevenue: Prisma.Decimal;
            charterCapital: Prisma.Decimal;
            representativeName: string;
            phone: string;
            address: string;
            updatedAt: Date;
        } | null;
        companyHash: string | null;
    }>;
    readiness(id: string, accountId?: string, user?: {
        id: string;
        roles: string[];
    }): Promise<{
        approvedIntakeAssessment: {
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
                component?: import("./portal.foundation").FinancialComponent;
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
        } | {
            policyVersion: string;
            dataReady: boolean;
            canSubmit: boolean;
            canAccept: boolean;
            businessValidity: string;
            creditDecision: null;
            missingFields: never[];
            missingDocuments: never[];
            requirements: never[];
            formErrors: string[];
            issues: {
                code: string;
                path: string;
                step: number;
                message: string;
            }[];
            note: string;
        } | null;
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
    } | {
        version: string;
        dataReady: null;
        canSubmit: boolean;
        issues: never[];
        note: string;
    }>;
    officers(): Promise<any[]>;
    assignmentHistory(id: string, user: {
        id: string;
        roles: string[];
    }): Promise<{
        id: string;
        note: string | null;
        assignedAt: Date;
        fromUser: {
            id: string;
            username: string;
            fullName: string;
        } | null;
        toUser: {
            id: string;
            username: string;
            fullName: string;
        };
        manager: {
            id: string;
            username: string;
            fullName: string;
        };
    }[]>;
    assign(id: string, body: any, managerId: string): Promise<any>;
    accept(id: string, userId: string, confirmExistingCompany?: boolean, confirmExistingCompanyFinancials?: boolean, expectedRevision?: number, submissionId?: string, clock?: Date): Promise<{
        loanId: string | null;
        request: {
            documents: {
                id: string;
                version: number;
                coverage: Prisma.JsonValue;
                documentGroup: string;
                fileName: string;
                fileSize: number;
                supersedesId: string | null;
                uploadedAt: Date;
                withdrawnAt: Date | null;
            }[];
            account: {
                id: string;
                phone: string;
                contactName: string;
                email: string;
            };
            assignedOfficer: {
                id: string;
                username: string;
                fullName: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            data: Prisma.JsonValue;
            updatedAt: Date;
            assignedTo: string | null;
            assignmentVersion: number;
            status: import(".prisma/client").$Enums.PortalRequestStatus;
            submittedAt: Date | null;
            revision: number;
            assignedAt: Date | null;
            reference: string;
            accountId: string;
            formVersion: number;
            checklistVersion: string;
            checklistSnapshot: Prisma.JsonValue | null;
            acceptedAt: Date | null;
            acceptedBy: string | null;
            assignedBy: string | null;
            loanId: string | null;
            correctionRequest: Prisma.JsonValue | null;
            correctionHistory: Prisma.JsonValue;
        };
    }>;
    intakeCycle(id: string, accountId?: string, user?: {
        id: string;
        roles: string[];
    }): Promise<{
        requestId: any;
        revision: any;
        status: any;
        currentSubmissionId: string;
        correctionRequest: any;
        correctionHistory: any;
        canAccept: boolean;
        checklist: {
            review: import("./portal.intake-cycle").IntakeReview | {
                id: string;
                label: string;
                decision: "ACCEPTED" | "NEEDS_CORRECTION";
                message: string;
                documentIds: string[];
                carriedFrom: string | undefined;
            } | null;
            id: string;
            label: string;
            group: string;
            documentIds: string[];
            fingerprint: string;
            guidance?: string;
            reviewCriteria?: string[];
        }[];
        submissions: {
            id: string;
            sequence: number;
            submittedAt: Date;
            returnedAt: Date | null;
            snapshot: import("./portal.snapshot").SubmissionSnapshot;
            changes: Prisma.JsonValue;
            returnItems: Prisma.JsonValue;
            reviews: (import("./portal.intake-cycle").IntakeReview | {
                id: string;
                label: string;
                decision: "ACCEPTED" | "NEEDS_CORRECTION";
                message: string;
                documentIds: string[];
                carriedFrom: string | undefined;
            })[];
        }[];
        issues: ({
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            status: string;
            kind: string | null;
            requestId: string;
            proposal: string;
            context: Prisma.JsonValue | null;
            publicMessage: string;
            resolution: string | null;
            createdBy: string;
            updatedBy: string;
        } | {
            id: string;
            status: string;
            publicMessage: string;
        })[];
    }>;
    reviewIntake(id: string, body: any, user: {
        id: string;
        roles: string[];
    }): Promise<{
        [x: string]: ({
            id: string;
            createdAt: Date;
            applicationId: string | null;
            message: string;
            title: string;
            readAt: Date | null;
            userId: string;
            requestId: string | null;
            assignmentChangeRequestId: string | null;
        } | {
            id: string;
            createdAt: Date;
            applicationId: string | null;
            message: string;
            title: string;
            readAt: Date | null;
            userId: string;
            requestId: string | null;
            assignmentChangeRequestId: string | null;
        })[] | ({
            id: string;
            createdAt: Date;
            requestedById: string;
            applicationId: string | null;
            reason: string;
            status: string;
            resolvedAt: Date | null;
            portalRequestId: string | null;
            assignmentVersionAtRequest: number;
            reasonCode: string;
            requestVersion: number;
            resolvedById: string | null;
            decisionReason: string | null;
            resolutionCode: string | null;
            targetOfficerId: string | null;
            managerRecipientCount: number;
            createClientRequestId: string;
            createPayloadHash: string;
            resolutionClientRequestId: string | null;
            resolutionPayloadHash: string | null;
        } | {
            id: string;
            createdAt: Date;
            requestedById: string;
            applicationId: string | null;
            reason: string;
            status: string;
            resolvedAt: Date | null;
            portalRequestId: string | null;
            assignmentVersionAtRequest: number;
            reasonCode: string;
            requestVersion: number;
            resolvedById: string | null;
            decisionReason: string | null;
            resolutionCode: string | null;
            targetOfficerId: string | null;
            managerRecipientCount: number;
            createClientRequestId: string;
            createPayloadHash: string;
            resolutionClientRequestId: string | null;
            resolutionPayloadHash: string | null;
        })[] | ({
            id: string;
            note: string | null;
            clientRequestId: string | null;
            payloadHash: string | null;
            requestId: string;
            assignmentChangeRequestId: string | null;
            assignedAt: Date;
            fromUserId: string | null;
            toUserId: string;
            managerId: string;
        } | {
            id: string;
            note: string | null;
            clientRequestId: string | null;
            payloadHash: string | null;
            requestId: string;
            assignmentChangeRequestId: string | null;
            assignedAt: Date;
            fromUserId: string | null;
            toUserId: string;
            managerId: string;
        })[] | ({
            id: string;
            version: number;
            coverage: Prisma.JsonValue | null;
            documentGroup: string;
            fileName: string;
            fileSize: number;
            mimeType: string;
            supersedesId: string | null;
            uploadedAt: Date;
            filePath: string;
            requestId: string;
            withdrawnAt: Date | null;
            clientUploadId: string | null;
            contentHash: string | null;
        } | {
            id: string;
            version: number;
            coverage: Prisma.JsonValue | null;
            documentGroup: string;
            fileName: string;
            fileSize: number;
            mimeType: string;
            supersedesId: string | null;
            uploadedAt: Date;
            filePath: string;
            requestId: string;
            withdrawnAt: Date | null;
            clientUploadId: string | null;
            contentHash: string | null;
        })[] | ({
            id: string;
            submittedAt: Date;
            sequence: number;
            requestId: string;
            sourceRevision: number;
            snapshot: Prisma.JsonValue;
            reviews: Prisma.JsonValue;
            changes: Prisma.JsonValue;
            returnItems: Prisma.JsonValue;
            returnedAt: Date | null;
        } | {
            id: string;
            submittedAt: Date;
            sequence: number;
            requestId: string;
            sourceRevision: number;
            snapshot: Prisma.JsonValue;
            reviews: Prisma.JsonValue;
            changes: Prisma.JsonValue;
            returnItems: Prisma.JsonValue;
            returnedAt: Date | null;
        })[] | ({
            id: string;
            createdAt: Date;
            actorId: string;
            kind: string;
            clientRequestId: string;
            payloadHash: string;
            requestId: string;
        } | {
            id: string;
            createdAt: Date;
            actorId: string;
            kind: string;
            clientRequestId: string;
            payloadHash: string;
            requestId: string;
        })[] | ({
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            status: string;
            kind: string | null;
            requestId: string;
            proposal: string;
            context: Prisma.JsonValue | null;
            publicMessage: string;
            resolution: string | null;
            createdBy: string;
            updatedBy: string;
        } | {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            status: string;
            kind: string | null;
            requestId: string;
            proposal: string;
            context: Prisma.JsonValue | null;
            publicMessage: string;
            resolution: string | null;
            createdBy: string;
            updatedBy: string;
        })[] | {
            id: string;
            createdAt: Date;
            applicationId: string | null;
            message: string;
            title: string;
            readAt: Date | null;
            userId: string;
            requestId: string | null;
            assignmentChangeRequestId: string | null;
        }[] | {
            id: string;
            createdAt: Date;
            requestedById: string;
            applicationId: string | null;
            reason: string;
            status: string;
            resolvedAt: Date | null;
            portalRequestId: string | null;
            assignmentVersionAtRequest: number;
            reasonCode: string;
            requestVersion: number;
            resolvedById: string | null;
            decisionReason: string | null;
            resolutionCode: string | null;
            targetOfficerId: string | null;
            managerRecipientCount: number;
            createClientRequestId: string;
            createPayloadHash: string;
            resolutionClientRequestId: string | null;
            resolutionPayloadHash: string | null;
        }[] | {
            id: string;
            note: string | null;
            clientRequestId: string | null;
            payloadHash: string | null;
            requestId: string;
            assignmentChangeRequestId: string | null;
            assignedAt: Date;
            fromUserId: string | null;
            toUserId: string;
            managerId: string;
        }[] | {
            id: string;
            version: number;
            coverage: Prisma.JsonValue | null;
            documentGroup: string;
            fileName: string;
            fileSize: number;
            mimeType: string;
            supersedesId: string | null;
            uploadedAt: Date;
            filePath: string;
            requestId: string;
            withdrawnAt: Date | null;
            clientUploadId: string | null;
            contentHash: string | null;
        }[] | {
            id: string;
            submittedAt: Date;
            sequence: number;
            requestId: string;
            sourceRevision: number;
            snapshot: Prisma.JsonValue;
            reviews: Prisma.JsonValue;
            changes: Prisma.JsonValue;
            returnItems: Prisma.JsonValue;
            returnedAt: Date | null;
        }[] | {
            id: string;
            createdAt: Date;
            actorId: string;
            kind: string;
            clientRequestId: string;
            payloadHash: string;
            requestId: string;
        }[] | {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string;
            status: string;
            kind: string | null;
            requestId: string;
            proposal: string;
            context: Prisma.JsonValue | null;
            publicMessage: string;
            resolution: string | null;
            createdBy: string;
            updatedBy: string;
        }[];
        [x: number]: never;
        [x: symbol]: never;
    } & {
        id: string;
        createdAt: Date;
        data: Prisma.JsonValue;
        updatedAt: Date;
        assignedTo: string | null;
        assignmentVersion: number;
        status: import(".prisma/client").$Enums.PortalRequestStatus;
        submittedAt: Date | null;
        revision: number;
        assignedAt: Date | null;
        reference: string;
        accountId: string;
        formVersion: number;
        checklistVersion: string;
        checklistSnapshot: Prisma.JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: Prisma.JsonValue | null;
        correctionHistory: Prisma.JsonValue;
    }>;
    returnIntake(id: string, body: any, user: {
        id: string;
        roles: string[];
    }): Promise<any>;
    requestIntakeCorrection(id: string, body: any, accountId: string): Promise<any>;
    decideIntakeCorrection(id: string, body: any, user: {
        id: string;
        roles: string[];
    }): Promise<any>;
    requestCompanyReconciliation(id: string, body: any, user: {
        id: string;
        roles: string[];
    }): Promise<any>;
    resolveCompanyReconciliation(id: string, body: any, user: {
        id: string;
        roles: string[];
    }): Promise<any>;
    intakeIssue(id: string, body: any, user: {
        id: string;
        roles: string[];
    }): Promise<any>;
}
