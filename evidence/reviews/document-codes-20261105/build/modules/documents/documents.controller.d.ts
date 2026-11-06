import { StreamableFile } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentType } from '@prisma/client';
export declare class DocumentsController {
    private readonly documentsService;
    constructor(documentsService: DocumentsService);
    findByApplication(applicationId: string): Promise<({
        uploader: {
            id: string;
            username: string;
            fullName: string;
        };
    } & {
        id: string;
        applicationId: string;
        fileName: string;
        fileSize: number;
        mimeType: string | null;
        uploadedAt: Date;
        documentType: import(".prisma/client").$Enums.DocumentType;
        filePath: string;
        uploadedBy: string;
        portalDocumentId: string | null;
    })[]>;
    create(applicationId: string, documentType: DocumentType, file: {
        buffer: Buffer;
        originalname: string;
        size: number;
        mimetype: string;
    }, userId: string, activeRole: string): Promise<{
        uploader: {
            id: string;
            username: string;
            fullName: string;
        };
    } & {
        id: string;
        applicationId: string;
        fileName: string;
        fileSize: number;
        mimeType: string | null;
        uploadedAt: Date;
        documentType: import(".prisma/client").$Enums.DocumentType;
        filePath: string;
        uploadedBy: string;
        portalDocumentId: string | null;
    }>;
    delete(id: string, user: {
        id: string;
        activeRole: string;
    }): Promise<{
        id: string;
        applicationId: string;
        fileName: string;
        fileSize: number;
        mimeType: string | null;
        uploadedAt: Date;
        documentType: import(".prisma/client").$Enums.DocumentType;
        filePath: string;
        uploadedBy: string;
        portalDocumentId: string | null;
    }>;
    download(id: string): Promise<StreamableFile>;
}
