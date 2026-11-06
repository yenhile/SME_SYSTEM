import { SupplementsService } from './supplements.service';
import { CreateSupplementDto } from './dto/create-supplement.dto';
import { ResolveSupplementDto } from './dto/resolve-supplement.dto';
import { PortalSupplementsService } from './portal-supplements.service';
export declare class SupplementsController {
    private readonly supplementsService;
    private readonly portalSupplements;
    constructor(supplementsService: SupplementsService, portalSupplements: PortalSupplementsService);
    portalDetails(id: string): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    }>;
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
    }): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    }>;
    download(id: string, fileId: string): Promise<import("@nestjs/common").StreamableFile>;
    getSupplements(applicationId: string): Promise<({
        requester: {
            id: string;
            username: string;
            fullName: string;
        };
    } & {
        id: string;
        applicationId: string;
        notes: string | null;
        requestContent: string;
        status: import(".prisma/client").$Enums.SupplementStatus;
        requestedAt: Date;
        deadlineAt: Date | null;
        resolvedAt: Date | null;
        portalSupplement: import("@prisma/client/runtime/library").JsonValue | null;
        requestedBy: string;
        reminderSentAt: Date | null;
        reminderEmailSentAt: Date | null;
        overdueAt: Date | null;
    })[]>;
    createRequest(applicationId: string, dto: CreateSupplementDto, userId: string, activeRole: string): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    } | ({
        requester: {
            id: string;
            username: string;
            fullName: string;
        };
    } & {
        id: string;
        applicationId: string;
        notes: string | null;
        requestContent: string;
        status: import(".prisma/client").$Enums.SupplementStatus;
        requestedAt: Date;
        deadlineAt: Date | null;
        resolvedAt: Date | null;
        portalSupplement: import("@prisma/client/runtime/library").JsonValue | null;
        requestedBy: string;
        reminderSentAt: Date | null;
        reminderEmailSentAt: Date | null;
        overdueAt: Date | null;
    })>;
    resolveRequest(supplementId: string, dto: ResolveSupplementDto, userId: string, activeRole: string): Promise<{
        revision: any;
        items: any;
        files: any;
        events: any;
    } | {
        id: string;
        applicationId: string;
        notes: string | null;
        requestContent: string;
        status: import(".prisma/client").$Enums.SupplementStatus;
        requestedAt: Date;
        deadlineAt: Date | null;
        resolvedAt: Date | null;
        portalSupplement: import("@prisma/client/runtime/library").JsonValue | null;
        requestedBy: string;
        reminderSentAt: Date | null;
        reminderEmailSentAt: Date | null;
        overdueAt: Date | null;
    }>;
}
