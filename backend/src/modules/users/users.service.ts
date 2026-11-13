import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma.service';
import { RoleCode } from '@prisma/client';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

import { lockOfficer } from '../workflow/loan-policy';
import { accountChangeEntries, recordAdminActions } from '../../admin-audit';

/** Việc còn trên tay một cán bộ: còn việc thì không được khóa hay bỏ vai trò CBTD. Danh sách tài khoản đếm theo cùng điều kiện. */
const OPEN_LOAN_WHERE = { completedAt: null };
const PENDING_PORTAL_WHERE = { status: { in: ['ASSIGNED' as const, 'RETURNED' as const] } };

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(roleFilter?: RoleCode) {
    if (roleFilter && !Object.values(RoleCode).includes(roleFilter)) throw new BadRequestException('Vai trò không hợp lệ.');
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
            assignedLoans: { where: OPEN_LOAN_WHERE },
            assignedPortalRequests: { where: PENDING_PORTAL_WHERE },
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
      pendingPortalRequests: u._count.assignedPortalRequests,
      createdAt: u.createdAt,
    }));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng.');
    return {
      id: user.id, username: user.username, fullName: user.fullName,
      email: user.email, phone: user.phone, branchName: user.branchName, isActive: user.isActive,
      roles: user.roles.map((r) => r.role.code),
    };
  }

  /** Không có `actorId` khi script dựng dữ liệu gọi trực tiếp; tài khoản tạo theo cách này không vào nhật ký quản trị. */
  async create(data: CreateUserDto, actorId?: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }],
      },
    });

    if (existing) {
      throw new BadRequestException('Tên đăng nhập hoặc Email đã tồn tại trong hệ thống.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const roles = await this.prisma.role.findMany({
      where: { code: { in: data.roles } },
    });
    if (roles.length !== data.roles.length) {
      throw new BadRequestException('Vai trò không hợp lệ.');
    }

    const newUser = await this.prisma.$transaction(async tx => {
      const created = await tx.user.create({
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
      if (actorId) {
        await recordAdminActions(tx, actorId, [{
          action: 'USER_CREATED', targetType: 'USER', targetId: created.id, targetLabel: created.username, before: null,
          after: {
            username: created.username, fullName: created.fullName, email: created.email, phone: created.phone ?? null,
            branchName: created.branchName ?? null, roles: created.roles.map(r => r.role.code).sort(),
          },
        }]);
      }
      return created;
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

  async update(id: string, data: UpdateUserDto, actorId: string) {
    const { roles: requestedRoles, ...profile } = data;
    let roles = requestedRoles;
    await this.prisma.$transaction(async tx => {
      await lockOfficer(tx,id);
      if (actorId === id && (profile.isActive === false || (roles && !roles.includes(RoleCode.ADMIN)))) {
        throw new BadRequestException('Không thể tự khóa tài khoản hoặc tự bỏ quyền Quản trị của chính mình.');
      }
      const current = await tx.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
      if (!current) throw new NotFoundException('Không tìm thấy người dùng.');
      const currentRoles = current.roles.map(link => link.role.code);
      if (actorId === id && roles) {
        const currentCodes = new Set(currentRoles);
        if (currentCodes.size !== roles.length || roles.some(code => !currentCodes.has(code))) {
          throw new BadRequestException('Không thể tự thay đổi vai trò của chính mình. Hãy nhờ một Quản trị viên khác thực hiện.');
        }
        roles = undefined;
      }
      const selected = roles ? await tx.role.findMany({ where: { code: { in: roles } } }) : null;
      if (selected && selected.length !== roles!.length) throw new BadRequestException('Vai trò không hợp lệ.');
      const losesCbtd = profile.isActive === false || (roles && !roles.includes(RoleCode.CBTD));
      if (losesCbtd) {
        const open = await tx.loanApplication.count({ where: { assignedTo: id, ...OPEN_LOAN_WHERE } });
        const pending = await tx.portalRequest.count({ where: { assignedTo: id, ...PENDING_PORTAL_WHERE } });
        if(pending>0) throw new BadRequestException(`Người này còn ${pending} đề nghị Portal cần xử lý. Hãy điều chuyển trước khi khóa hoặc bỏ vai trò CBTD.`);
        if (open > 0) throw new BadRequestException(`Người này đang phụ trách ${open} hồ sơ chưa hoàn tất. Hãy điều chuyển hồ sơ cho CBTD khác trước khi khóa hoặc bỏ vai trò CBTD.`);
      }
      await tx.user.update({ where: { id }, data: profile });
      if (selected) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: selected.map(role => ({ userId: id, roleId: role.id })) });
      }
      await recordAdminActions(tx, actorId, accountChangeEntries(
        { id, username: current.username, fullName: current.fullName, phone: current.phone, branchName: current.branchName, isActive: current.isActive, roles: currentRoles },
        { ...profile, roles },
      ));
    });
    return { message: 'Cập nhật thành công', user: await this.findOne(id) };
  }
}
