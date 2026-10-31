import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma.service';
import { jwtSecret } from '../../common/security/jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: jwtSecret(),
    });
  }

  async validate(request: any, payload: any) {
    if (payload.type === 'portal' || payload.aud === 'sme-enterprise-portal' || payload.iss === 'sme-enterprise-portal') throw new UnauthorizedException('Phiên doanh nghiệp không có quyền nội bộ.');
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
