import { PrismaService } from '../../prisma.service';
export declare class DashboardService {
    private prisma;
    constructor(prisma: PrismaService);
    getOverviewStats(): Promise<{
        totalApplications: number;
        activeApplications: number;
        approvedApplications: number;
        rejectedApplications: number;
        timeoutApplications: number;
        totalCompletedStages: number;
        delayedStages: number;
        slaOnTimeRate: number;
        totalCompletedStagesPa1: number;
        delayedStagesPa1: number;
        slaOnTimeRatePa1: number | null;
        highRiskLoans: number;
    }>;
    getSlaBottleneckAnalysis(): Promise<{
        stageCode: import(".prisma/client").$Enums.StageCode;
        stageName: string;
        standardSlaHours: number;
        totalHandled: number;
        delayedCount: number;
        delayRate: number;
        avgNetWorkHours: number;
        isBottleneck: boolean;
        pa1: {
            totalHandled: number;
            delayedCount: number;
            delayRate: number;
            avgNetWorkHours: number;
            isBottleneck: boolean;
        };
    }[]>;
    getOverdueSupplements(now?: Date): Promise<{
        id: any;
        applicationId: any;
        applicationCode: any;
        companyName: any;
        assignedOfficer: any;
        assignedOfficerId: any;
        requestedAt: any;
        deadlineAt: any;
        overdueAt: any;
        waitingOn: "ENTERPRISE" | "BANK";
        daysOverdue: number;
    }[]>;
    getEarlyWarningList(user?: {
        activeRole?: string;
    }): Promise<{
        id: string;
        applicationCode: string;
        companyName: any;
        industry: any;
        loanAmount: number;
        currentStage: import(".prisma/client").$Enums.StageCode;
        currentStatus: import(".prisma/client").$Enums.LoanStatus;
        supplementCount: number;
        assignedOfficer: string;
        assignedOfficerId: string | null;
        riskLevel: import(".prisma/client").$Enums.RiskLevel | null;
        delayProbability: number | null;
        predictionStatus: import("../prediction/prediction-status").PredictionStatus;
        predictedAt: Date | null;
        topReasons: string[];
    }[]>;
    getStageDistribution(): Promise<{
        stage: "TIEP_NHAN" | "THAM_DINH" | "HOAN_TAT";
        count: number;
    }[]>;
}
