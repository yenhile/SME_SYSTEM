import { PrismaService } from '../../prisma.service';
import { PredictionService } from '../prediction/prediction.service';
import { CreateSupplementDto } from './dto/create-supplement.dto';
import { ResolveSupplementDto } from './dto/resolve-supplement.dto';
export declare class SupplementsService {
    private prisma;
    private predictionService;
    private readonly logger;
    constructor(prisma: PrismaService, predictionService: PredictionService);
    createSupplementRequest(applicationId: string, dto: CreateSupplementDto, userId: string, activeRole?: string, clock?: Date): Promise<{
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
    resolveSupplementRequest(supplementId: string, dto: ResolveSupplementDto, userId: string, activeRole?: string, clock?: Date): Promise<{
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
}
