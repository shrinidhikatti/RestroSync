import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, isActive: true, role: true, restaurantId: true, restaurant: { select: { status: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        errorCode: 'ACCOUNT_DISABLED',
        userMessage: 'Your account has been deactivated. Contact your manager.',
      });
    }

    // Block suspended restaurant access (except Super Admin)
    if (user.restaurant && user.restaurant.status === 'SUSPENDED') {
      throw new UnauthorizedException({
        errorCode: 'RESTAURANT_SUSPENDED',
        userMessage: 'This restaurant account has been suspended. Contact support.',
      });
    }

    return payload;
  }
}
