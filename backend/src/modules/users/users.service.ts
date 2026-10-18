import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma.service';
import { RoleCode } from '@prisma/client';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

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
      workloadActiveLoans: u._count.assignedLoans, // Số hồ sơ đang phụ trách
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

  async create(data: CreateUserDto) {
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

  async update(id: string, data: UpdateUserDto) {
    const { roles, ...profile } = data;
    await this.prisma.$transaction(async tx => {
      const selected = roles ? await tx.role.findMany({ where: { code: { in: roles } } }) : null;
      if (selected && selected.length !== roles!.length) throw new BadRequestException('Vai trò không hợp lệ.');
      await tx.user.update({ where: { id }, data: profile });
      if (selected) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: selected.map(role => ({ userId: id, roleId: role.id })) });
      }
    });
    return { message: 'Cập nhật thành công', user: await this.findOne(id) };
  }
}
