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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const prisma_service_1 = require("../../prisma.service");
const client_1 = require("@prisma/client");
const loan_policy_1 = require("../workflow/loan-policy");
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(roleFilter) {
        if (roleFilter && !Object.values(client_1.RoleCode).includes(roleFilter))
            throw new common_1.BadRequestException('Vai trò không hợp lệ.');
        const users = await this.prisma.user.findMany({
            where: roleFilter
                ? {
                    roles: {
                        some: {
                            role: {
                                code: roleFilter,
                            },
                        },
                    },
                }
                : undefined,
            include: {
                roles: {
                    include: { role: true },
                },
                _count: {
                    select: {
                        assignedLoans: {
                            where: {
                                currentStatus: {
                                    in: ['RECEIVED', 'CHECKED', 'SUPPLEMENT_REQUIRED', 'PENDING_APPRAISAL'],
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return users.map((u) => ({
            id: u.id,
            username: u.username,
            fullName: u.fullName,
            email: u.email,
            phone: u.phone,
            branchName: u.branchName,
            isActive: u.isActive,
            roles: u.roles.map((r) => r.role.code),
            workloadActiveLoans: u._count.assignedLoans,
            createdAt: u.createdAt,
        }));
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                roles: {
                    include: { role: true },
                },
            },
        });
        if (!user)
            throw new common_1.NotFoundException('Không tìm thấy người dùng.');
        return {
            id: user.id, username: user.username, fullName: user.fullName,
            email: user.email, phone: user.phone, branchName: user.branchName, isActive: user.isActive,
            roles: user.roles.map((r) => r.role.code),
        };
    }
    async create(data) {
        const existing = await this.prisma.user.findFirst({
            where: {
                OR: [{ username: data.username }, { email: data.email }],
            },
        });
        if (existing) {
            throw new common_1.BadRequestException('Tên đăng nhập hoặc Email đã tồn tại trong hệ thống.');
        }
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password, salt);
        const roles = await this.prisma.role.findMany({
            where: { code: { in: data.roles } },
        });
        if (roles.length !== data.roles.length) {
            throw new common_1.BadRequestException('Vai trò không hợp lệ.');
        }
        const newUser = await this.prisma.user.create({
            data: {
                username: data.username,
                passwordHash,
                fullName: data.fullName,
                email: data.email,
                phone: data.phone,
                branchName: data.branchName || 'Chi nhánh TP.HCM',
                roles: {
                    create: roles.map(role => ({ roleId: role.id })),
                },
            },
            include: {
                roles: {
                    include: { role: true },
                },
            },
        });
        return {
            message: 'Tạo tài khoản thành công',
            user: {
                id: newUser.id,
                username: newUser.username,
                fullName: newUser.fullName,
                email: newUser.email,
                roles: newUser.roles.map((r) => r.role.code),
            },
        };
    }
    async update(id, data, actorId) {
        const { roles, ...profile } = data;
        await this.prisma.$transaction(async (tx) => {
            await (0, loan_policy_1.lockOfficer)(tx, id);
            const selected = roles ? await tx.role.findMany({ where: { code: { in: roles } } }) : null;
            if (selected && selected.length !== roles.length)
                throw new common_1.BadRequestException('Vai trò không hợp lệ.');
            if (actorId === id && (profile.isActive === false || (roles && !roles.includes(client_1.RoleCode.ADMIN)))) {
                throw new common_1.BadRequestException('Không thể tự khóa tài khoản hoặc tự bỏ quyền Quản trị của chính mình.');
            }
            const losesCbtd = profile.isActive === false || (roles && !roles.includes(client_1.RoleCode.CBTD));
            if (losesCbtd) {
                const open = await tx.loanApplication.count({ where: { assignedTo: id, completedAt: null } });
                const pending = await tx.portalRequest.count({ where: { assignedTo: id, status: { in: ['ASSIGNED', 'RETURNED'] } } });
                if (pending > 0)
                    throw new common_1.BadRequestException(`Người này còn ${pending} đề nghị Portal cần xử lý. Hãy điều chuyển trước khi khóa hoặc bỏ vai trò CBTD.`);
                if (open > 0)
                    throw new common_1.BadRequestException(`Người này đang phụ trách ${open} hồ sơ chưa hoàn tất. Hãy điều chuyển hồ sơ cho CBTD khác trước khi khóa hoặc bỏ vai trò CBTD.`);
            }
            await tx.user.update({ where: { id }, data: profile });
            if (selected) {
                await tx.userRole.deleteMany({ where: { userId: id } });
                await tx.userRole.createMany({ data: selected.map(role => ({ userId: id, roleId: role.id })) });
            }
        });
        return { message: 'Cập nhật thành công', user: await this.findOne(id) };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map