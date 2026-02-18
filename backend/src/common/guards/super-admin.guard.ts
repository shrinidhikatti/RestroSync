import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user || user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException({
        errorCode: 'SUPER_ADMIN_ONLY',
        userMessage: 'This action requires Super Admin access.',
      });
    }
    return true;
  }
}
