import { PrismaService } from '../../prisma.service';
import { RoleCode } from '@prisma/client';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(roleFilter?: RoleCode): Promise<{
        id: string;
        username: string;
        fullName: string;
        email: string;
        phone: string | null;
        branchName: string;
        isActive: boolean;
        roles: import(".prisma/client").$Enums.RoleCode[];
        workloadActiveLoans: number;
        createdAt: Date;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        username: string;
        fullName: string;
        email: string;
        phone: string | null;
        branchName: string;
        isActive: boolean;
        roles: import(".prisma/client").$Enums.RoleCode[];
    }>;
    create(data: CreateUserDto): Promise<{
        message: string;
        user: {
            id: string;
            username: string;
            fullName: string;
            email: string;
            roles: import(".prisma/client").$Enums.RoleCode[];
        };
    }>;
    update(id: string, data: UpdateUserDto, actorId?: string): Promise<{
        message: string;
        user: {
            id: string;
            username: string;
            fullName: string;
            email: string;
            phone: string | null;
            branchName: string;
            isActive: boolean;
            roles: import(".prisma/client").$Enums.RoleCode[];
        };
    }>;
}
