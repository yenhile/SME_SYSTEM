import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: process.env.JWT_SECRET || 'sme_loan_workflow_secret_key_2026',
    });
  }

  async validate(request: any, payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
    }

    const availableRoles = user.roles.map((r) => r.role.code);
    const activeRole = request.headers['x-active-role'] || availableRoles[0];
    if (!availableRoles.includes(activeRole)) {
      throw new ForbiddenException('Vai trò này chưa được cấp cho tài khoản.');
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
}
