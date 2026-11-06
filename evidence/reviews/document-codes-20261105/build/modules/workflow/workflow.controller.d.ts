import { WorkflowService } from './workflow.service';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { CloseOverdueDto } from './dto/close-overdue.dto';
export declare class WorkflowController {
    private readonly workflowService;
    constructor(workflowService: WorkflowService);
    getWorkflowStages(): import(".prisma/client").Prisma.PrismaPromise<{
        standardSlaHours: number;
        stageName: string;
        id: string;
        stageCode: import(".prisma/client").$Enums.StageCode;
        orderIndex: number;
        createdAt: Date;
    }[]>;
    getWorkflowHistory(id: string): Promise<({
        stage: {
            standardSlaHours: number;
            stageName: string;
            id: string;
            stageCode: import(".prisma/client").$Enums.StageCode;
            orderIndex: number;
            createdAt: Date;
        };
        handler: {
            id: string;
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
    })[]>;
    transitionStage(id: string, dto: TransitionStageDto, user: any): Promise<{
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
    closeOverdueSupplement(id: string, dto: CloseOverdueDto, user: any): Promise<{
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
}
