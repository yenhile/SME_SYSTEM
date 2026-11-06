export declare function validateAssignmentOperation(body: {
    expectedAssignmentVersion?: unknown;
    clientRequestId?: unknown;
}): void;
export declare function assignmentReason(value: unknown, required?: boolean): string | null;
export declare const assignmentPayloadHash: (parts: unknown[]) => string;
export declare function assertAssignmentVersion(actual: number | undefined, expected: number): void;
