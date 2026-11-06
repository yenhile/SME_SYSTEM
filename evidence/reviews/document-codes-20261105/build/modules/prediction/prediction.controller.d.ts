import { PredictionService } from './prediction.service';
export declare class PredictionController {
    private readonly prediction;
    constructor(prediction: PredictionService);
    predict(id: string): Promise<{
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
