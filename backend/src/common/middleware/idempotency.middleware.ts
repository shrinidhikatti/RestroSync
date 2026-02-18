import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);

  constructor(private redis: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Only apply to POST/PUT/PATCH methods
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers['x-idempotency-key'] as string;
    if (!idempotencyKey) {
      return next();
    }

    // Check if we already have a cached response
    const cached = await this.redis.checkIdempotency(idempotencyKey);
    if (cached) {
      this.logger.debug(`Idempotency hit for key: ${idempotencyKey}`);
      const parsed = JSON.parse(cached);
      return res.status(parsed.statusCode || 200).json(parsed.body);
    }

    // Store original json method to intercept response
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      // Cache the response with 24h TTL
      const cacheData = JSON.stringify({ statusCode: res.statusCode, body });
      this.redis.setIdempotency(idempotencyKey, cacheData).catch((err) => {
        this.logger.warn(`Failed to cache idempotency response: ${err}`);
      });
      return originalJson(body);
    };

    next();
  }
}
