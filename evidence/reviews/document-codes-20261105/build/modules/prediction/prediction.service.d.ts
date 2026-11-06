import { PrismaService } from '../../prisma.service';
export declare class PredictionService {
    private prisma;
    private readonly logger;
    private readonly mlServiceUrl;
    constructor(prisma: PrismaService);
    predictForApplication(applicationId: string): Promise<{
        unavailable: true;
        reason: "PA1_INCOMPATIBLE";
        message: string;
    } | {
        topReasons: any;
        id: string;
        applicationId: string;
        predictionTimestamp: Date;
        riskLevel: import(".prisma/client").$Enums.RiskLevel;
        delayProbability: number;
        topReasonsJson: string | null;
        modelVersion: string;
        unavailable?: undefined;
        reason?: undefined;
        message?: undefined;
    }>;
}
