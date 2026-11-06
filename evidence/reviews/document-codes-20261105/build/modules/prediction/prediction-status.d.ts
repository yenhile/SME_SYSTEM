export type PredictionStatus = 'AVAILABLE' | 'INCOMPATIBLE_PA1' | 'NONE';
export declare const PREDICTION_PA1_MESSAGE = "Ch\u01B0a c\u00F3 d\u1EF1 b\u00E1o t\u01B0\u01A1ng th\u00EDch PA1.";
export declare function predictionStatusOf(hasPrediction: boolean, firstStagePolicy: string | null | undefined): PredictionStatus;
interface FirstStageReader {
    applicationStageHistory: {
        findMany(args: any): Promise<Array<{
            applicationId: string;
            slaPolicy: string | null;
        }>>;
    };
}
export declare function firstStagePolicies(db: FirstStageReader, applicationIds: string[]): Promise<Map<string, string | null>>;
export {};
