import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.userId) return false;

    // Super admin bypasses permission checks
    if (user.role === 'SUPER_ADMIN') return true;

    // Get user's permissions via role_permissions
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: {
        role: user.role,
        restaurantId: user.restaurantId,
      },
      include: { permission: true },
    });

    const userPermissions = rolePermissions.map((rp) => rp.permission.code);

    return requiredPermissions.every((perm) => userPermissions.includes(perm));
  }
}
