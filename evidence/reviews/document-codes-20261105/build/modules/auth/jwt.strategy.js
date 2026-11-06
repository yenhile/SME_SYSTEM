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
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const passport_jwt_1 = require("passport-jwt");
const prisma_service_1 = require("../../prisma.service");
const jwt_secret_1 = require("../../common/security/jwt-secret");
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    prisma;
    constructor(prisma) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            passReqToCallback: true,
            secretOrKey: (0, jwt_secret_1.jwtSecret)(),
        });
        this.prisma = prisma;
    }
    async validate(request, payload) {
        if (payload.type === 'portal' || payload.aud === 'sme-enterprise-portal' || payload.iss === 'sme-enterprise-portal')
            throw new common_1.UnauthorizedException('Phiên doanh nghiệp không có quyền nội bộ.');
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: {
                roles: {
                    include: { role: true },
                },
            },
        });
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
        }
        const availableRoles = user.roles.map((r) => r.role.code);
        if (!availableRoles.length) {
            throw new common_1.UnauthorizedException('Tài khoản chưa được cấp vai trò nào.');
        }
        const activeRole = request.headers['x-active-role'] || availableRoles[0];
        if (!availableRoles.includes(activeRole)) {
            throw new common_1.ForbiddenException({
                statusCode: 403,
                error: 'Forbidden',
                errorCode: 'ACTIVE_ROLE_INVALID',
                message: 'Vai trò này chưa được cấp cho tài khoản.',
                availableRoles,
            });
        }
        return {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            roles: [activeRole],
            activeRole,
            availableRoles,
            branchName: user.branchName,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map