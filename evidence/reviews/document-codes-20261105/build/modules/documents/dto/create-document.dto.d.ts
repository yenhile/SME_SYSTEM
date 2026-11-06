import { DocumentType } from '@prisma/client';
export declare class CreateDocumentDto {
    documentType: DocumentType;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType?: string;
}
