import { CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
export declare class LoanAccessGuard implements CanActivate {
    private readonly prisma;
    constructor(prisma: PrismaService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
