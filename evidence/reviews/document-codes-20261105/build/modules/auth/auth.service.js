"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const prisma_service_1 = require("../../prisma.service");
const login_throttle_1 = require("./login-throttle");
let AuthService = class AuthService {
    prisma;
    jwtService;
    loginThrottle = new login_throttle_1.LoginThrottle();
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async login(loginDto, now = Date.now()) {
        const { username, password } = loginDto;
        const throttleKey = username.trim().toLowerCase();
        const waitMs = this.loginThrottle.retryAfterMs(throttleKey, now);
        if (waitMs > 0) {
            throw new common_1.HttpException(`Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(waitMs / 60000)} phút.`, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const user = await this.prisma.user.findUnique({
            where: { username },
            include: {
                roles: {
                    include: { role: true },
                },
            },
        });
        if (!user) {
            this.loginThrottle.recordFailure(throttleKey, now);
            throw new common_1.UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác.');
        }
        if (!user.isActive) {
            throw new common_1.UnauthorizedException('Tài khoản đã bị tạm khóa, vui lòng liên hệ Quản trị viên.');
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            this.loginThrottle.recordFailure(throttleKey, now);
            throw new common_1.UnauthorizedException('Tên đăng nhập hoặc mật khẩu không chính xác.');
        }
        this.loginThrottle.reset(throttleKey);
        const userRoles = user.roles.map((r) => r.role.code);
        const payload = {
            sub: user.id,
            username: user.username,
            roles: userRoles,
        };
        const accessToken = this.jwtService.sign(payload);
        return {
            message: 'Đăng nhập thành công',
            accessToken,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                branchName: user.branchName,
                roles: userRoles,
            },
        };
    }
    async changePassword(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Không tìm thấy thông tin người dùng.');
        }
        const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
        if (!isMatch) {
            throw new common_1.BadRequestException('Mật khẩu hiện tại không chính xác.');
        }
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(dto.newPassword, salt);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newHash },
        });
        return { message: 'Đổi mật khẩu thành công.' };
    }
    async getProfile(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: { role: true },
                },
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Người dùng không tồn tại.');
        }
        return {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            branchName: user.branchName,
            roles: user.roles.map((r) => r.role.code),
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map