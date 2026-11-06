import { PrismaService } from '../../prisma.service';
import { PredictionService } from '../prediction/prediction.service';
import { TransitionStageDto } from './dto/transition-stage.dto';
import { CloseOverdueDto } from './dto/close-overdue.dto';
import { Prisma } from '@prisma/client';
export declare class WorkflowService {
    private prisma;
    private predictionService;
    private readonly logger;
    constructor(prisma: PrismaService, predictionService: PredictionService);
    getWorkflowStages(): Prisma.PrismaPromise<{
        standardSlaHours: number;
        stageName: string;
        id: string;
        stageCode: import(".prisma/client").$Enums.StageCode;
        orderIndex: number;
        createdAt: Date;
    }[]>;
    getWorkflowHistory(applicationId: string): Promise<({
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
    transitionStage(applicationId: string, dto: TransitionStageDto, user: {
        id: string;
        activeRole: string;
    }, clock?: Date, transaction?: Prisma.TransactionClient): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        applicationCode: string;
        companyId: string;
        companySnapshot: Prisma.JsonValue | null;
        loanPurpose: string;
        loanType: import(".prisma/client").$Enums.LoanType;
        proposedAmount: Prisma.Decimal;
        officialAmount: Prisma.Decimal | null;
        approvedAmount: Prisma.Decimal | null;
        loanTermMonths: number;
        interestRate: Prisma.Decimal | null;
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
    closeOverdueSupplement(applicationId: string, dto: CloseOverdueDto, user: {
        id: string;
        activeRole: string;
    }, now?: Date): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        applicationCode: string;
        companyId: string;
        companySnapshot: Prisma.JsonValue | null;
        loanPurpose: string;
        loanType: import(".prisma/client").$Enums.LoanType;
        proposedAmount: Prisma.Decimal;
        officialAmount: Prisma.Decimal | null;
        approvedAmount: Prisma.Decimal | null;
        loanTermMonths: number;
        interestRate: Prisma.Decimal | null;
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
