import { Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma.service';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private prisma;
    constructor(prisma: PrismaService);
    validate(request: any, payload: any): Promise<{
        id: string;
        username: string;
        fullName: string;
        email: string;
        roles: any[];
        activeRole: any;
        availableRoles: import(".prisma/client").$Enums.RoleCode[];
        branchName: string;
    }>;
}
export {};
