import { StreamableFile } from '@nestjs/common';
import { PortalAuthService } from './portal.auth';
import { PortalService } from './portal.service';
import type { PortalFile } from './portal.validation';
export declare class PortalAuthController {
    private auth;
    constructor(auth: PortalAuthService);
    register(body: any, req: any): Promise<{
        message: string;
    }>;
    verify(body: any, req: any): Promise<{
        message: string;
    }>;
    resend(body: any, req: any): Promise<{
        message: string;
    }>;
    login(body: any, req: any): Promise<{
        accessToken: string;
        account: {
            id: any;
            email: any;
            contactName: any;
            phone: any;
        };
    }>;
    forgot(body: any, req: any): Promise<{
        message: string;
    }>;
    reset(body: any, req: any): Promise<{
        message: string;
    }>;
    me(req: any): any;
}
export declare class PortalRequestsController {
    private service;
    constructor(service: PortalService);
    list(req: any): Promise<any[] | ({
        documents: {
            id: string;
            version: number;
            coverage: import("@prisma/client/runtime/library").JsonValue;
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
        data: import("@prisma/client/runtime/library").JsonValue;
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
        checklistSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: import("@prisma/client/runtime/library").JsonValue | null;
        correctionHistory: import("@prisma/client/runtime/library").JsonValue;
    })[]>;
    config(): {
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
    create(req: any, body: any): Promise<{
        documents: {
            id: string;
            version: number;
            coverage: import("@prisma/client/runtime/library").JsonValue;
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
        data: import("@prisma/client/runtime/library").JsonValue;
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
        checklistSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: import("@prisma/client/runtime/library").JsonValue | null;
        correctionHistory: import("@prisma/client/runtime/library").JsonValue;
    }>;
    one(req: any, id: string): Promise<any>;
    update(req: any, id: string, body: any): Promise<{
        documents: {
            id: string;
            version: number;
            coverage: import("@prisma/client/runtime/library").JsonValue;
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
        data: import("@prisma/client/runtime/library").JsonValue;
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
        checklistSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: import("@prisma/client/runtime/library").JsonValue | null;
        correctionHistory: import("@prisma/client/runtime/library").JsonValue;
    }>;
    status(req: any, id: string): Promise<any>;
    checklist(req: any, id: string): Promise<{
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
    readiness(req: any, id: string): Promise<{
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
    cycle(req: any, id: string): Promise<{
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
            changes: import("@prisma/client/runtime/library").JsonValue;
            returnItems: import("@prisma/client/runtime/library").JsonValue;
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
            context: import("@prisma/client/runtime/library").JsonValue | null;
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
    correction(req: any, id: string, body: any): Promise<any>;
    documentHeads(req: any, id: string): Promise<{
        id: string;
        version: number;
        coverage: import("@prisma/client/runtime/library").JsonValue;
        documentGroup: string;
        fileName: string;
        fileSize: number;
        supersedesId: string | null;
        uploadedAt: Date;
        withdrawnAt: Date | null;
    }[]>;
    private uploadOptions;
    upload(req: any, id: string, body: any, file: PortalFile): Promise<{
        documents: {
            id: string;
            version: number;
            coverage: import("@prisma/client/runtime/library").JsonValue;
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
        data: import("@prisma/client/runtime/library").JsonValue;
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
        checklistSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: import("@prisma/client/runtime/library").JsonValue | null;
        correctionHistory: import("@prisma/client/runtime/library").JsonValue;
    }>;
    replace(req: any, id: string, documentId: string, body: any, file: PortalFile): Promise<{
        documents: {
            id: string;
            version: number;
            coverage: import("@prisma/client/runtime/library").JsonValue;
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
        data: import("@prisma/client/runtime/library").JsonValue;
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
        checklistSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: import("@prisma/client/runtime/library").JsonValue | null;
        correctionHistory: import("@prisma/client/runtime/library").JsonValue;
    }>;
    versions(req: any, id: string, documentId: string): Promise<{
        id: string;
        version: number;
        coverage: import("@prisma/client/runtime/library").JsonValue;
        documentGroup: string;
        fileName: string;
        fileSize: number;
        supersedesId: string | null;
        uploadedAt: Date;
        withdrawnAt: Date | null;
    }[]>;
    delete(req: any, id: string, documentId: string, body: any): Promise<{
        documents: {
            id: string;
            version: number;
            coverage: import("@prisma/client/runtime/library").JsonValue;
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
        data: import("@prisma/client/runtime/library").JsonValue;
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
        checklistSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: import("@prisma/client/runtime/library").JsonValue | null;
        correctionHistory: import("@prisma/client/runtime/library").JsonValue;
    }>;
    download(req: any, id: string, documentId: string): Promise<StreamableFile>;
    submit(req: any, id: string, body: any): Promise<any>;
}
export declare class PortalIntakesController {
    private service;
    constructor(service: PortalService);
    list(req: any): Promise<any[] | ({
        documents: {
            id: string;
            version: number;
            coverage: import("@prisma/client/runtime/library").JsonValue;
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
        data: import("@prisma/client/runtime/library").JsonValue;
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
        checklistSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: import("@prisma/client/runtime/library").JsonValue | null;
        correctionHistory: import("@prisma/client/runtime/library").JsonValue;
    })[]>;
    officers(): Promise<any[]>;
    config(): {
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
    assign(req: any, id: string, body: any): Promise<any>;
    history(req: any, id: string): Promise<{
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
    one(req: any, id: string): Promise<any>;
    match(req: any, id: string): Promise<{
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
            annualRevenue: import("@prisma/client/runtime/library").Decimal;
            charterCapital: import("@prisma/client/runtime/library").Decimal;
            representativeName: string;
            phone: string;
            address: string;
            updatedAt: Date;
        } | null;
        companyHash: string | null;
    }>;
    cycle(req: any, id: string): Promise<{
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
            changes: import("@prisma/client/runtime/library").JsonValue;
            returnItems: import("@prisma/client/runtime/library").JsonValue;
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
            context: import("@prisma/client/runtime/library").JsonValue | null;
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
    review(req: any, id: string, body: any): Promise<{
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
            coverage: import("@prisma/client/runtime/library").JsonValue | null;
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
            coverage: import("@prisma/client/runtime/library").JsonValue | null;
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
            snapshot: import("@prisma/client/runtime/library").JsonValue;
            reviews: import("@prisma/client/runtime/library").JsonValue;
            changes: import("@prisma/client/runtime/library").JsonValue;
            returnItems: import("@prisma/client/runtime/library").JsonValue;
            returnedAt: Date | null;
        } | {
            id: string;
            submittedAt: Date;
            sequence: number;
            requestId: string;
            sourceRevision: number;
            snapshot: import("@prisma/client/runtime/library").JsonValue;
            reviews: import("@prisma/client/runtime/library").JsonValue;
            changes: import("@prisma/client/runtime/library").JsonValue;
            returnItems: import("@prisma/client/runtime/library").JsonValue;
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
            context: import("@prisma/client/runtime/library").JsonValue | null;
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
            context: import("@prisma/client/runtime/library").JsonValue | null;
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
            coverage: import("@prisma/client/runtime/library").JsonValue | null;
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
            snapshot: import("@prisma/client/runtime/library").JsonValue;
            reviews: import("@prisma/client/runtime/library").JsonValue;
            changes: import("@prisma/client/runtime/library").JsonValue;
            returnItems: import("@prisma/client/runtime/library").JsonValue;
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
            context: import("@prisma/client/runtime/library").JsonValue | null;
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
        data: import("@prisma/client/runtime/library").JsonValue;
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
        checklistSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        acceptedAt: Date | null;
        acceptedBy: string | null;
        assignedBy: string | null;
        loanId: string | null;
        correctionRequest: import("@prisma/client/runtime/library").JsonValue | null;
        correctionHistory: import("@prisma/client/runtime/library").JsonValue;
    }>;
    returnCorrection(req: any, id: string, body: any): Promise<any>;
    correctionDecision(req: any, id: string, body: any): Promise<any>;
    reconciliation(req: any, id: string, body: any): Promise<any>;
    resolveReconciliation(req: any, id: string, body: any): Promise<any>;
    issue(req: any, id: string, body: any): Promise<any>;
    download(req: any, id: string, documentId: string): Promise<StreamableFile>;
    accept(req: any, id: string, body: any): Promise<{
        loanId: string | null;
        request: {
            documents: {
                id: string;
                version: number;
                coverage: import("@prisma/client/runtime/library").JsonValue;
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
            data: import("@prisma/client/runtime/library").JsonValue;
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
            checklistSnapshot: import("@prisma/client/runtime/library").JsonValue | null;
            acceptedAt: Date | null;
            acceptedBy: string | null;
            assignedBy: string | null;
            loanId: string | null;
            correctionRequest: import("@prisma/client/runtime/library").JsonValue | null;
            correctionHistory: import("@prisma/client/runtime/library").JsonValue;
        };
    }>;
}
