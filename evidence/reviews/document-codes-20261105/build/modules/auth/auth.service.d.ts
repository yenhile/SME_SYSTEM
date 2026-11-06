import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    private readonly loginThrottle;
    constructor(prisma: PrismaService, jwtService: JwtService);
    login(loginDto: LoginDto, now?: number): Promise<{
        message: string;
        accessToken: string;
        user: {
            id: string;
            username: string;
            fullName: string;
            email: string;
            phone: string | null;
            branchName: string;
            roles: import(".prisma/client").$Enums.RoleCode[];
        };
    }>;
    changePassword(userId: string, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    getProfile(userId: string): Promise<{
        id: string;
        username: string;
        fullName: string;
        email: string;
        phone: string | null;
        branchName: string;
        roles: import(".prisma/client").$Enums.RoleCode[];
    }>;
}
