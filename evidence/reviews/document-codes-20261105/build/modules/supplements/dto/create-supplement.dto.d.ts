export declare class CreateSupplementDto {
    clientRequestId?: string;
    items?: {
        documentGroup: string;
        documentTypeCode: string;
        period?: string;
        reason: string;
    }[];
    requestContent: string;
    deadlineAt?: string;
    notes?: string;
}
