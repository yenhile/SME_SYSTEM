import { HealthService } from './health.service';
export declare class HealthController {
    private readonly healthService;
    constructor(healthService: HealthService);
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
