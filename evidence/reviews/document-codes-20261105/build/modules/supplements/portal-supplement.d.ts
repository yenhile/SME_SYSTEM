export type SupplementMetadata = {
    version: 1;
    revision: number;
    createId: string;
    createHash: string;
    items: any[];
    files: any[];
    responses: any[];
    events: any[];
    operations: any[];
};
export declare function uuid(value: unknown): asserts value is string;
export declare function createMetadata(items: any[], clientRequestId: string): SupplementMetadata;
export declare function metadata(request: any): SupplementMetadata;
export declare function revision(m: SupplementMetadata, value: unknown): void;
export declare function replay(m: SupplementMetadata, id: unknown, kind: string, hash: string): boolean;
export declare function heads(m: SupplementMetadata): any[];
export declare function respond(m: SupplementMetadata, documentIds: unknown): void;
export declare function review(m: SupplementMetadata, itemId: string, body: any): void;
export declare function waitingOn(request: {
    portalSupplement?: any;
}): 'ENTERPRISE' | 'BANK';
export declare function safeView(r: any): {
    revision: any;
    items: any;
    files: any;
    events: any;
};
