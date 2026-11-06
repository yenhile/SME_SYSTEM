import { StageCode, LoanStatus } from '@prisma/client';
export declare class TransitionStageDto {
    targetStage: StageCode;
    targetStatus: LoanStatus;
    reportVersionId?: string;
    notes?: string;
    officialAmount?: number;
    approvedAmount?: number;
    interestRate?: number;
    rejectionReasonCode?: string;
    rejectionNote?: string;
}
