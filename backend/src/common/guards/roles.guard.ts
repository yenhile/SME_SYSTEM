import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleCode } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.roles) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này.');
    }

    // Kiểm tra xem user có ít nhất 1 role nằm trong danh sách requiredRoles hay không
    const hasRole = user.roles.some((r: string) => requiredRoles.includes(r as RoleCode));
    if (!hasRole) {
      throw new ForbiddenException(`Quyền truy cập bị từ chối. Yêu cầu vai trò: ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
