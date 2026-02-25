import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AppGateway } from '../gateway/app.gateway';

@SkipThrottle()
@ApiTags('Health')
@Controller()
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
    private gateway: AppGateway,
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

  @Get('health/socket')
  getSocketHealth() {
    const connectedClients = this.gateway.getConnectionCount();
    const adapter = this.gateway.server?.sockets?.adapter as any;
    const rooms = adapter?.rooms
      ? Object.fromEntries(
          [...adapter.rooms.entries()]
            .filter(([key]: [string, any]) => !adapter.sids?.has(key)) // exclude per-socket rooms
            .map(([key, val]: [string, any]) => [key, val.size]),
        )
      : {};
    return {
      status: 'ok',
      connectedClients,
      rooms,
      roomCount: Object.keys(rooms).length,
    };
  }

  @Get('time')
  getServerTime() {
    return { serverTime: new Date().toISOString() };
  }
}
