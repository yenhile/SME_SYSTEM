import { PrismaService } from '../../prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentType } from '@prisma/client';
export declare class DocumentsService {
    private prisma;
    private readonly uploadDir;
    constructor(prisma: PrismaService);
    upload(applicationId: string, documentType: DocumentType, file: {
        buffer: Buffer;
        originalname: string;
        size: number;
        mimetype: string;
    }, userId: string, activeRole?: string): Promise<{
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
    download(id: string): Promise<{
        buffer: NonSharedBuffer;
        fileName: string;
    }>;
    create(applicationId: string, dto: CreateDocumentDto, userId: string, activeRole?: string): Promise<{
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
    private withdrawConfirmation;
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
    delete(id: string, actor: {
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
}
