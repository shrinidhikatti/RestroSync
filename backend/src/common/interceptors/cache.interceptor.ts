import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../redis/redis.service';

/**
 * HTTP Cache Interceptor using Redis.
 *
 * Usage: @UseInterceptors(new HttpCacheInterceptor(redisService, 'key', 300))
 *
 * Only caches GET requests. Cache key is auto-derived from the URL or
 * can be passed explicitly.
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpCacheInterceptor.name);

  constructor(
    private readonly redis: RedisService,
    private readonly cacheKey: string,
    private readonly ttlSeconds: number = 300, // 5 min default
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') return next.handle();

    const key = `cache:${this.cacheKey}`;

    const cached = await this.redis.get(key);
    if (cached) {
      try {
        return of(JSON.parse(cached));
      } catch {
        // corrupt cache — fall through
      }
    }

    return next.handle().pipe(
      tap(async (data) => {
        try {
          await this.redis.set(key, JSON.stringify(data), this.ttlSeconds);
        } catch (err) {
          this.logger.warn(`Cache SET failed: ${(err as Error).message}`);
        }
      }),
    );
  }
}
