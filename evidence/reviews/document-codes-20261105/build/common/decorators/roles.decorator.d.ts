import { RoleCode } from '@prisma/client';
export declare const ROLES_KEY = "roles";
export declare const Roles: (...roles: RoleCode[]) => import("@nestjs/common").CustomDecorator<string>;
