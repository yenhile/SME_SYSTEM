export declare function transferLoan(tx: any, id: string, body: any, managerId: string, changeRequestId?: string): Promise<{
    loan: any;
    assignmentRecord: any;
    updatedLoan: any;
    replayed: boolean;
}>;
export declare function transferPortal(tx: any, id: string, body: any, managerId: string, include?: any, changeRequestId?: string): Promise<any>;
export declare function assignmentPrediction(service: any, applicationId: string, replayed: boolean): Promise<{
    status: string;
    message: any;
}>;
