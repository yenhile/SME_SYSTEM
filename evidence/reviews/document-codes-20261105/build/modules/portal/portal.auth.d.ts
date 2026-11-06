import { CanActivate, ExecutionContext, OnModuleDestroy } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';
import { PortalMailer } from './portal.mailer';
export declare class PortalAuthService implements OnModuleDestroy {
    private prisma;
    private jwt;
    private mailer;
    private rate;
    private resetJobs;
    private readonly logger;
    constructor(prisma: PrismaService, jwt: JwtService, mailer: PortalMailer);
    throttle(key: string, max?: number): void;
    register(body: any, ip: string): Promise<{
        message: string;
    }>;
    issueCode(id: string): Promise<void>;
    resend(body: any, ip: string): Promise<{
        message: string;
    }>;
    verify(body: any, ip: string): Promise<{
        message: string;
    }>;
    login(body: any, ip: string): Promise<{
        accessToken: string;
        account: {
            id: any;
            email: any;
            contactName: any;
            phone: any;
        };
    }>;
    forgotPassword(body: any, ip: string): Promise<{
        message: string;
    }>;
    onModuleDestroy(): Promise<void>;
    private issuePasswordReset;
    resetPassword(body: any, ip: string): Promise<{
        message: string;
    }>;
    me(id: string, authVersion?: number): Promise<{
        id: any;
        email: any;
        contactName: any;
        phone: any;
    }>;
}
export declare class PortalGuard implements CanActivate {
    private jwt;
    private auth;
    constructor(jwt: JwtService, auth: PortalAuthService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
