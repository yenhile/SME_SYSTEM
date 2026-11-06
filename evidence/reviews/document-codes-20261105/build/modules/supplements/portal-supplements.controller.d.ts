import { StreamableFile } from '@nestjs/common';
import { PortalFile } from '../portal/portal.validation';
import { PortalSupplementsService } from './portal-supplements.service';
export declare const supplementDownload: (result: {
    buffer: Buffer;
    fileName: string;
}) => StreamableFile;
export declare class PortalSupplementsController {
    private service;
    constructor(service: PortalSupplementsService);
    list(requestId: string, req: any): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    }[]>;
    respond(requestId: string, id: string, req: any, body: any): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    }>;
    upload(requestId: string, id: string, itemId: string, req: any, body: any, file: PortalFile): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    }>;
    download(requestId: string, id: string, fileId: string, req: any): Promise<StreamableFile>;
}
