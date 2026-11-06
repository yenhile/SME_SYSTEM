import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private service;
    constructor(service: NotificationsService);
    list(req: any): Promise<{
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
    read(req: any, id: string): Promise<{
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
