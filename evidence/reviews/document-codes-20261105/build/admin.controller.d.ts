import { StageCode } from '@prisma/client';
import { PrismaService } from './prisma.service';
export declare class UpdateSlaDto {
    standardSlaHours: number;
    stageName: string;
}
export declare class AdminController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    stages(): import(".prisma/client").Prisma.PrismaPromise<{
        standardSlaHours: number;
        stageName: string;
        id: string;
        stageCode: import(".prisma/client").$Enums.StageCode;
        orderIndex: number;
        createdAt: Date;
    }[]>;
    updateStage(code: StageCode, body: UpdateSlaDto): import(".prisma/client").Prisma.Prisma__WorkflowStageClient<{
        standardSlaHours: number;
        stageName: string;
        id: string;
        stageCode: import(".prisma/client").$Enums.StageCode;
        orderIndex: number;
        createdAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
}
