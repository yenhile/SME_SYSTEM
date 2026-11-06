import { PrismaService } from '../../prisma.service';
export declare class NotificationsService {
    private prisma;
    constructor(prisma: PrismaService);
    list(userId: string): Promise<{
        items: {
            id: string;
            createdAt: Date;
            applicationId: string | null;
            message: string;
            title: string;
            readAt: Date | null;
            requestId: string | null;
            assignmentChangeRequestId: string | null;
        }[];
        unreadCount: number;
    }>;
    read(id: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        applicationId: string | null;
        message: string;
        title: string;
        readAt: Date | null;
        requestId: string | null;
        assignmentChangeRequestId: string | null;
    }>;
}
