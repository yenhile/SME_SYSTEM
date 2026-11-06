import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PortalMailer } from '../portal/portal.mailer';
export declare class SupplementRemindersService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly mailer;
    private readonly logger;
    private timer?;
    private running;
    constructor(prisma: PrismaService, mailer: PortalMailer);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private safeScan;
    scan(now?: Date): Promise<{
        reminded: number;
        overdue: number;
    }>;
    private notify;
    private markOverdue;
    private remind;
}
