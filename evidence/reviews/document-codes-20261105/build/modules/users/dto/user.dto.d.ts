import { RoleCode } from '@prisma/client';
export declare class CreateUserDto {
    username: string;
    password: string;
    fullName: string;
    email: string;
    phone?: string;
    branchName?: string;
    roles: RoleCode[];
}
export declare class UpdateUserDto {
    fullName?: string;
    phone?: string;
    branchName?: string;
    isActive?: boolean;
    roles?: RoleCode[];
}
