import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Tenant isolation middleware.
 * Extracts restaurantId and branchId from JWT (set by Passport)
 * and attaches them to request for downstream use.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as any).user as {
      restaurantId?: string;
      branchId?: string;
      role?: string;
    } | undefined;

    // Super admin routes don't need tenant context
    if (user?.role === 'SUPER_ADMIN') {
      return next();
    }

    // Attach tenant context to request for easy access
    if (user?.restaurantId) {
      (req as any).restaurantId = user.restaurantId;
      (req as any).branchId = user.branchId;
    }

    next();
  }
}
