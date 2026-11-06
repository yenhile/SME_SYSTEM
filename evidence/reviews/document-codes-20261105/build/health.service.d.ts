import { PrismaService } from './prisma.service';
export declare class HealthService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    check(): Promise<{
        status: string;
        services: {
            backend: string;
            database: string;
            prediction: string;
        };
        timestamp: string;
    }>;
}
