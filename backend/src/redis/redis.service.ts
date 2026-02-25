import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private isAvailable = true;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.client = redisUrl
      ? new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 200, 2000),
        })
      : new Redis({
          host: this.configService.get('REDIS_HOST', 'localhost'),
          port: this.configService.get<number>('REDIS_PORT', 6379),
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 200, 2000),
        });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error', err.message);
      this.isAvailable = false;
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
      this.isAvailable = true;
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  /** Get value with graceful fallback on Redis failure */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.warn(`Redis GET failed for key ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  /** Set value with graceful fallback on Redis failure */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (err) {
      this.logger.warn(`Redis SET failed for key ${key}: ${(err as Error).message}`);
      return false;
    }
  }

  /** Delete key with graceful fallback */
  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (err) {
      this.logger.warn(`Redis DEL failed for key ${key}: ${(err as Error).message}`);
      return false;
    }
  }

  /** Check idempotency key — returns cached response or null */
  async checkIdempotency(key: string): Promise<string | null> {
    return this.get(`idempotency:${key}`);
  }

  /** Store idempotency response (24h TTL) */
  async setIdempotency(key: string, response: string): Promise<boolean> {
    return this.set(`idempotency:${key}`, response, 86400);
  }

  /** Check if Redis is healthy */
  async isHealthy(): Promise<{ status: string; memoryUsage?: string; connectedClients?: string }> {
    try {
      const info = await this.client.info('memory');
      const clientInfo = await this.client.info('clients');
      const memMatch = info.match(/used_memory_human:(.+)/);
      const clientMatch = clientInfo.match(/connected_clients:(\d+)/);
      return {
        status: 'ok',
        memoryUsage: memMatch?.[1]?.trim(),
        connectedClients: clientMatch?.[1]?.trim(),
      };
    } catch {
      return { status: 'down' };
    }
  }

  getIsAvailable(): boolean {
    return this.isAvailable;
  }
}
