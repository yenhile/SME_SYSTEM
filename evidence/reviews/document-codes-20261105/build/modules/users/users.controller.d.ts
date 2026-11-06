import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { RoleCode } from '@prisma/client';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    findAll(role?: RoleCode): Promise<{
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
    create(body: CreateUserDto): Promise<{
        message: string;
        user: {
            id: string;
            username: string;
            fullName: string;
            email: string;
            roles: import(".prisma/client").$Enums.RoleCode[];
        };
    }>;
    update(id: string, body: UpdateUserDto, actorId: string): Promise<{
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
