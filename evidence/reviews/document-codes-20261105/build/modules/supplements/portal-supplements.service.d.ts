import { PrismaService } from '../../prisma.service';
import { PortalFile } from '../portal/portal.validation';
export declare class PortalSupplementsService {
    private prisma;
    private readonly dir;
    constructor(prisma: PrismaService);
    private body;
    private owner;
    list(requestId: string, accountId: string): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    }[]>;
    details(id: string): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    }>;
    private locked;
    private pending;
    private save;
    review(id: string, itemId: string, body: any, user: {
        id: string;
        activeRole: string;
    }): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    }>;
    returnCorrections(id: string, body: any, user: {
        id: string;
        activeRole: string;
    }, clock?: Date): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    }>;
    respond(requestId: string, accountId: string, id: string, body: any, clock?: Date): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    }>;
    upload(requestId: string, accountId: string, id: string, itemId: string, file: PortalFile, body: any): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    }>;
    download(id: string, fileId: string, scope?: {
        requestId: string;
        accountId: string;
    }): Promise<{
        buffer: Buffer<ArrayBufferLike>;
        fileName: any;
    }>;
    private fileBytes;
}
