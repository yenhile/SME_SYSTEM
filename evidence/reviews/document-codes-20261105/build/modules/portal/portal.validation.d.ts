export declare const portalSecret: () => string;
export declare const groups: string[];
export type PortalFile = {
    buffer: Buffer;
    originalname: string;
    size: number;
    mimetype: string;
};
export declare function validatePortalData(input: unknown, complete?: boolean): Record<string, any>;
export declare function validatePortalFile(group: string, file: PortalFile): Promise<{
    fileName: string;
    mimeType: string;
}>;
