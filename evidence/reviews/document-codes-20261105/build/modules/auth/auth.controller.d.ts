import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(loginDto: LoginDto): Promise<{
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
    getProfile(userId: string): Promise<{
        id: string;
        username: string;
        fullName: string;
        email: string;
        phone: string | null;
        branchName: string;
        roles: import(".prisma/client").$Enums.RoleCode[];
    }>;
    changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{
        message: string;
    }>;
}
