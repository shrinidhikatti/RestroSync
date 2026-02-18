import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  @Get('health')
  async getHealth() {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/db')
  async getDbHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return { status: 'down' };
    }
  }

  @Get('health/redis')
  async getRedisHealth() {
    return this.redis.isHealthy();
  }

  @Get('config/app-version')
  getAppVersion() {
    return {
      minAppVersion: this.config.get('MIN_APP_VERSION', '1.0.0'),
      latestAppVersion: this.config.get('LATEST_APP_VERSION', '1.0.0'),
      updateUrl: this.config.get('APP_UPDATE_URL', ''),
    };
  }

  @Get('time')
  getServerTime() {
    return { serverTime: new Date().toISOString() };
  }
}
