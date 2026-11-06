import { PrismaService } from '../../prisma.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoanStatus, StageCode } from '@prisma/client';
export declare class LoanApplicationsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateLoanDto, creatorUserId: string, clock?: Date): Promise<{
        message: string;
        loan: {
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
            };
            assignedUser: {
                id: string;
                username: string;
                fullName: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            applicationCode: string;
            companyId: string;
            companySnapshot: import("@prisma/client/runtime/library").JsonValue | null;
            loanPurpose: string;
            loanType: import(".prisma/client").$Enums.LoanType;
            proposedAmount: import("@prisma/client/runtime/library").Decimal;
            officialAmount: import("@prisma/client/runtime/library").Decimal | null;
            approvedAmount: import("@prisma/client/runtime/library").Decimal | null;
            loanTermMonths: number;
            interestRate: import("@prisma/client/runtime/library").Decimal | null;
            currentStage: import(".prisma/client").$Enums.StageCode;
            currentStatus: import(".prisma/client").$Enums.LoanStatus;
            assignedTo: string | null;
            assignmentVersion: number;
            rejectionReasonCode: string | null;
            rejectionNote: string | null;
            isDocumentComplete: boolean;
            supplementCount: number;
            completedAt: Date | null;
            businessPolicyVersion: string | null;
            intakeOfficerId: string | null;
        };
    }>;
    findAll(user: any, query: {
        stage?: StageCode;
        status?: LoanStatus;
        keyword?: string;
        myOnly?: boolean;
    }): Promise<{
        predictionStatus: import("../prediction/prediction-status").PredictionStatus;
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
        };
        stageHistories: ({
            stage: {
                standardSlaHours: number;
                stageName: string;
                id: string;
                stageCode: import(".prisma/client").$Enums.StageCode;
                orderIndex: number;
                createdAt: Date;
            };
        } & {
            id: string;
            slaPolicy: string | null;
            slaCalendarVersion: string | null;
            enteredAt: Date;
            applicationId: string;
            stageId: string;
            exitedAt: Date | null;
            actualDurationHours: number | null;
            pausedAt: Date | null;
            pausedDurationHours: number;
            netWorkDurationHours: number | null;
            slaStandardHours: number;
            isDelayed: boolean;
            handledBy: string | null;
            notes: string | null;
        })[];
        assignedUser: {
            id: string;
            username: string;
            fullName: string;
            email: string;
        } | null;
        supplementRequests: {
            id: string;
            status: import(".prisma/client").$Enums.SupplementStatus;
            requestedAt: Date;
            deadlineAt: Date | null;
            reminderSentAt: Date | null;
            overdueAt: Date | null;
        }[];
        delayPredictions: {
            id: string;
            applicationId: string;
            predictionTimestamp: Date;
            riskLevel: import(".prisma/client").$Enums.RiskLevel;
            delayProbability: number;
            topReasonsJson: string | null;
            modelVersion: string;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        applicationCode: string;
        companyId: string;
        companySnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        loanPurpose: string;
        loanType: import(".prisma/client").$Enums.LoanType;
        proposedAmount: import("@prisma/client/runtime/library").Decimal;
        officialAmount: import("@prisma/client/runtime/library").Decimal | null;
        approvedAmount: import("@prisma/client/runtime/library").Decimal | null;
        loanTermMonths: number;
        interestRate: import("@prisma/client/runtime/library").Decimal | null;
        currentStage: import(".prisma/client").$Enums.StageCode;
        currentStatus: import(".prisma/client").$Enums.LoanStatus;
        assignedTo: string | null;
        assignmentVersion: number;
        rejectionReasonCode: string | null;
        rejectionNote: string | null;
        isDocumentComplete: boolean;
        supplementCount: number;
        completedAt: Date | null;
        businessPolicyVersion: string | null;
        intakeOfficerId: string | null;
    }[]>;
    findOne(id: string, now?: Date, actor?: {
        id: string;
    }): Promise<{
        source: string;
        coordinationRestrictions: {
            writeBlocked: boolean;
            decisionBlocked: boolean;
        };
        makerCheckerRestrictions: {
            isIndependent: boolean;
            decisionBlocked: boolean;
            decisionBlockReason: string | null;
            canCloseOverdue: boolean;
            closeOverdueBlockReason: string | null;
        };
        predictionStatus: import("../prediction/prediction-status").PredictionStatus;
        slaState: {
            policy: string | null;
            calendarVersion: string | null;
            waiting: string | null;
            slaRunning: boolean;
        };
        liveSla: Record<string, unknown> | null;
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
        };
        portalRequest: ({
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
        }) | null;
        stageHistories: ({
            stage: {
                standardSlaHours: number;
                stageName: string;
                id: string;
                stageCode: import(".prisma/client").$Enums.StageCode;
                orderIndex: number;
                createdAt: Date;
            };
            handler: {
                username: string;
                fullName: string;
            } | null;
        } & {
            id: string;
            slaPolicy: string | null;
            slaCalendarVersion: string | null;
            enteredAt: Date;
            applicationId: string;
            stageId: string;
            exitedAt: Date | null;
            actualDurationHours: number | null;
            pausedAt: Date | null;
            pausedDurationHours: number;
            netWorkDurationHours: number | null;
            slaStandardHours: number;
            isDelayed: boolean;
            handledBy: string | null;
            notes: string | null;
        })[];
        assignedUser: {
            id: string;
            phone: string | null;
            username: string;
            fullName: string;
            email: string;
        } | null;
        documents: ({
            uploader: {
                fullName: string;
            };
        } & {
            id: string;
            applicationId: string;
            fileName: string;
            fileSize: number;
            mimeType: string | null;
            uploadedAt: Date;
            documentType: import(".prisma/client").$Enums.DocumentType;
            filePath: string;
            uploadedBy: string;
            portalDocumentId: string | null;
        })[];
        supplementRequests: ({
            requester: {
                fullName: string;
            };
        } & {
            id: string;
            applicationId: string;
            notes: string | null;
            requestContent: string;
            status: import(".prisma/client").$Enums.SupplementStatus;
            requestedAt: Date;
            deadlineAt: Date | null;
            resolvedAt: Date | null;
            portalSupplement: import("@prisma/client/runtime/library").JsonValue | null;
            requestedBy: string;
            reminderSentAt: Date | null;
            reminderEmailSentAt: Date | null;
            overdueAt: Date | null;
        })[];
        assignments: ({
            fromUser: {
                fullName: string;
            } | null;
            toUser: {
                fullName: string;
            };
            manager: {
                fullName: string;
            };
        } & {
            id: string;
            applicationId: string;
            reason: string | null;
            clientRequestId: string | null;
            payloadHash: string | null;
            assignmentChangeRequestId: string | null;
            reassignedAt: Date;
            fromUserId: string | null;
            toUserId: string;
            reassignedBy: string;
        })[];
        delayPredictions: {
            id: string;
            applicationId: string;
            predictionTimestamp: Date;
            riskLevel: import(".prisma/client").$Enums.RiskLevel;
            delayProbability: number;
            topReasonsJson: string | null;
            modelVersion: string;
        }[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        applicationCode: string;
        companyId: string;
        companySnapshot: import("@prisma/client/runtime/library").JsonValue | null;
        loanPurpose: string;
        loanType: import(".prisma/client").$Enums.LoanType;
        proposedAmount: import("@prisma/client/runtime/library").Decimal;
        officialAmount: import("@prisma/client/runtime/library").Decimal | null;
        approvedAmount: import("@prisma/client/runtime/library").Decimal | null;
        loanTermMonths: number;
        interestRate: import("@prisma/client/runtime/library").Decimal | null;
        currentStage: import(".prisma/client").$Enums.StageCode;
        currentStatus: import(".prisma/client").$Enums.LoanStatus;
        assignedTo: string | null;
        assignmentVersion: number;
        rejectionReasonCode: string | null;
        rejectionNote: string | null;
        isDocumentComplete: boolean;
        supplementCount: number;
        completedAt: Date | null;
        businessPolicyVersion: string | null;
        intakeOfficerId: string | null;
    }>;
    private makerCheckerRestrictions;
    private coordinationRestrictions;
    checkDocuments(id: string, isComplete: boolean, actor: {
        id: string;
        activeRole: string;
    }): Promise<{
        message: string;
        loan: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            applicationCode: string;
            companyId: string;
            companySnapshot: import("@prisma/client/runtime/library").JsonValue | null;
            loanPurpose: string;
            loanType: import(".prisma/client").$Enums.LoanType;
            proposedAmount: import("@prisma/client/runtime/library").Decimal;
            officialAmount: import("@prisma/client/runtime/library").Decimal | null;
            approvedAmount: import("@prisma/client/runtime/library").Decimal | null;
            loanTermMonths: number;
            interestRate: import("@prisma/client/runtime/library").Decimal | null;
            currentStage: import(".prisma/client").$Enums.StageCode;
            currentStatus: import(".prisma/client").$Enums.LoanStatus;
            assignedTo: string | null;
            assignmentVersion: number;
            rejectionReasonCode: string | null;
            rejectionNote: string | null;
            isDocumentComplete: boolean;
            supplementCount: number;
            completedAt: Date | null;
            businessPolicyVersion: string | null;
            intakeOfficerId: string | null;
        };
    }>;
    setOfficialAmount(id: string, officialAmount: number, actor: {
        id: string;
        activeRole: string;
    }): Promise<{
        message: string;
        loan: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            applicationCode: string;
            companyId: string;
            companySnapshot: import("@prisma/client/runtime/library").JsonValue | null;
            loanPurpose: string;
            loanType: import(".prisma/client").$Enums.LoanType;
            proposedAmount: import("@prisma/client/runtime/library").Decimal;
            officialAmount: import("@prisma/client/runtime/library").Decimal | null;
            approvedAmount: import("@prisma/client/runtime/library").Decimal | null;
            loanTermMonths: number;
            interestRate: import("@prisma/client/runtime/library").Decimal | null;
            currentStage: import(".prisma/client").$Enums.StageCode;
            currentStatus: import(".prisma/client").$Enums.LoanStatus;
            assignedTo: string | null;
            assignmentVersion: number;
            rejectionReasonCode: string | null;
            rejectionNote: string | null;
            isDocumentComplete: boolean;
            supplementCount: number;
            completedAt: Date | null;
            businessPolicyVersion: string | null;
            intakeOfficerId: string | null;
        };
        isExceedLimit: boolean;
        nextAction: string;
    }>;
}
