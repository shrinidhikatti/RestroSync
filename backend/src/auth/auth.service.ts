import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/decorators/current-user.decorator';
import {
  LoginDto,
  PinLoginDto,
  RegisterDto,
  RefreshTokenDto,
  ChangePasswordDto,
  RegisterDeviceDto,
} from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { restaurant: { select: { status: true } } },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException({
        errorCode: 'INVALID_CREDENTIALS',
        userMessage: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        errorCode: 'ACCOUNT_DISABLED',
        userMessage: 'Your account has been deactivated. Contact your manager.',
      });
    }

    if (user.restaurant && user.restaurant.status === 'SUSPENDED') {
      throw new UnauthorizedException({
        errorCode: 'RESTAURANT_SUSPENDED',
        userMessage: 'This restaurant account has been suspended.',
      });
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = await this.generateTokens({
      userId: user.id,
      name: user.name,
      restaurantId: user.restaurantId,
      branchId: user.branchId,
      role: user.role,
      deviceId: null,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
        branchId: user.branchId,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async pinLogin(dto: PinLoginDto) {
    // Verify device is registered
    const device = await this.prisma.device.findUnique({
      where: { id: dto.deviceId },
    });

    if (!device || !device.isActive) {
      throw new ForbiddenException({
        errorCode: 'DEVICE_NOT_REGISTERED',
        userMessage: 'This device is not registered. Contact your manager.',
      });
    }

    // Find user by PIN within the same restaurant
    const users = await this.prisma.user.findMany({
      where: {
        restaurantId: device.restaurantId,
        isActive: true,
      },
    });

    let matchedUser = null;
    for (const user of users) {
      if (user.pin && (await bcrypt.compare(dto.pin, user.pin))) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      // Increment pin attempts on device (track by device for lockout)
      throw new UnauthorizedException({
        errorCode: 'INVALID_PIN',
        userMessage: 'Incorrect PIN.',
      });
    }

    // Check PIN lockout
    if (matchedUser.pinLockedUntil && matchedUser.pinLockedUntil > new Date()) {
      const remainingMin = Math.ceil((matchedUser.pinLockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException({
        errorCode: 'PIN_LOCKED',
        userMessage: `Too many attempts. Locked for ${remainingMin} minutes. Use email/password login.`,
      });
    }

    // Reset pin attempts on success
    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: { pinAttempts: 0, pinLockedUntil: null, lastLogin: new Date() },
    });

    // Update device last seen
    await this.prisma.device.update({
      where: { id: dto.deviceId },
      data: { lastSeen: new Date() },
    });

    const tokens = await this.generateTokens({
      userId: matchedUser.id,
      name: matchedUser.name,
      restaurantId: matchedUser.restaurantId,
      branchId: matchedUser.branchId || device.branchId,
      role: matchedUser.role,
      deviceId: dto.deviceId,
    });

    return {
      ...tokens,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        role: matchedUser.role,
        restaurantId: matchedUser.restaurantId,
        branchId: matchedUser.branchId || device.branchId,
      },
    };
  }

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException({
        errorCode: 'EMAIL_EXISTS',
        userMessage: 'An account with this email already exists.',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create restaurant + owner + default branch in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          name: dto.restaurantName,
          email: dto.email,
          phone: dto.phone,
          dpdpaConsentGiven: dto.dpdpaConsent || false,
          dpdpaConsentDate: dto.dpdpaConsent ? new Date() : null,
        },
      });

      const branch = await tx.branch.create({
        data: {
          restaurantId: restaurant.id,
          name: 'Main Branch',
        },
      });

      const owner = await tx.user.create({
        data: {
          restaurantId: restaurant.id,
          branchId: null, // Owner has access to all branches
          name: dto.ownerName,
          email: dto.email,
          phone: dto.phone,
          password: hashedPassword,
          role: 'OWNER',
        },
      });

      // Create onboarding progress
      await tx.onboardingProgress.create({
        data: { restaurantId: restaurant.id },
      });

      // Create default permissions for the restaurant
      await this.seedDefaultPermissions(tx, restaurant.id);

      return { restaurant, branch, owner };
    });

    const tokens = await this.generateTokens({
      userId: result.owner.id,
      name: result.owner.name,
      restaurantId: result.restaurant.id,
      branchId: null,
      role: 'OWNER',
      deviceId: null,
    });

    return {
      ...tokens,
      user: {
        id: result.owner.id,
        name: result.owner.name,
        email: result.owner.email,
        role: result.owner.role,
        restaurantId: result.restaurant.id,
      },
      restaurant: {
        id: result.restaurant.id,
        name: result.restaurant.name,
      },
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: { select: { id: true, name: true, role: true, restaurantId: true, branchId: true, isActive: true } } },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) {
        await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      }
      throw new UnauthorizedException({
        errorCode: 'REFRESH_TOKEN_EXPIRED',
        userMessage: 'Session expired. Please log in again.',
      });
    }

    if (!stored.user.isActive) {
      throw new UnauthorizedException({
        errorCode: 'ACCOUNT_DISABLED',
        userMessage: 'Your account has been deactivated.',
      });
    }

    // Rotate: delete old, create new
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await this.generateTokens({
      userId: stored.user.id,
      name: stored.user.name,
      restaurantId: stored.user.restaurantId,
      branchId: stored.user.branchId,
      role: stored.user.role,
      deviceId: null,
    });

    return tokens;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException({
        errorCode: 'WRONG_PASSWORD',
        userMessage: 'Current password is incorrect.',
      });
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    return { message: 'Password changed successfully.' };
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.restaurantId) {
      throw new ForbiddenException();
    }

    // Only Owner and Manager can register devices
    if (!['OWNER', 'MANAGER'].includes(user.role)) {
      throw new ForbiddenException({
        errorCode: 'INSUFFICIENT_ROLE',
        userMessage: 'Only Owner or Manager can register devices.',
      });
    }

    const device = await this.prisma.device.create({
      data: {
        restaurantId: user.restaurantId,
        branchId: dto.branchId,
        name: dto.name,
        deviceFingerprint: dto.deviceFingerprint,
        registeredBy: userId,
      },
    });

    return device;
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If that email is registered, you will receive a reset link.' };
    }

    // Generate a short-lived reset token (store in Redis/DB as a simple UUID)
    const resetToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 min expiry

    // Store token in refresh_tokens table with a special prefix
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: `PWD_RESET_${resetToken}`,
        expiresAt,
      },
    });

    // In production, this token would be emailed to the user.
    // For dev/demo, we return it directly so the frontend can use it.
    const isDev = this.config.get('NODE_ENV') === 'development';
    return {
      message: 'If that email is registered, you will receive a reset link.',
      ...(isDev ? { resetToken } : {}),
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: `PWD_RESET_${token}` },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new BadRequestException({
        errorCode: 'INVALID_RESET_TOKEN',
        userMessage: 'Reset link is invalid or has expired. Please request a new one.',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: storedToken.userId },
      data: { password: hashedPassword, mustChangePassword: false },
    });

    // Clean up reset token
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  async setPin(userId: string, pin: string) {
    if (!/^\d{4}$/.test(pin)) {
      throw new BadRequestException({
        errorCode: 'INVALID_PIN',
        userMessage: 'PIN must be exactly 4 digits.',
      });
    }

    const hashedPin = await bcrypt.hash(pin, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { pin: hashedPin },
    });

    return { message: 'PIN updated successfully.' };
  }

  // ---- Private helpers ----

  private async generateTokens(payload: JwtPayload) {
    const accessToken = this.jwtService.sign(payload);

    const refreshToken = uuidv4();
    const refreshExpiry = this.config.get('JWT_REFRESH_EXPIRY', '7d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(refreshExpiry) || 7);

    // Enforce max 3 refresh tokens per user
    const existingTokens = await this.prisma.refreshToken.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'asc' },
    });
    if (existingTokens.length >= 3) {
      await this.prisma.refreshToken.delete({ where: { id: existingTokens[0].id } });
    }

    await this.prisma.refreshToken.create({
      data: {
        userId: payload.userId,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private async seedDefaultPermissions(tx: any, restaurantId: string) {
    const permissionCodes = [
      { code: 'menu:view', name: 'View Menu' },
      { code: 'menu:edit', name: 'Edit Menu' },
      { code: 'menu:toggle_availability', name: 'Toggle Item Availability' },
      { code: 'order:create', name: 'Create Order' },
      { code: 'order:cancel', name: 'Cancel Order' },
      { code: 'order:apply_discount', name: 'Apply Discount' },
      { code: 'order:price_override', name: 'Override Price' },
      { code: 'order:set_priority', name: 'Set Order Priority' },
      { code: 'order:override_availability', name: 'Override Item Availability' },
      { code: 'order:complimentary', name: 'Create Complimentary Order' },
      { code: 'bill:generate', name: 'Generate Bill' },
      { code: 'bill:void', name: 'Void Bill' },
      { code: 'bill:reprint', name: 'Reprint Bill' },
      { code: 'bill:refund', name: 'Issue Refund' },
      { code: 'kot:view', name: 'View KOT' },
      { code: 'kot:mark_ready', name: 'Mark KOT Ready' },
      { code: 'inventory:view', name: 'View Inventory' },
      { code: 'inventory:edit', name: 'Edit Inventory' },
      { code: 'reports:view', name: 'View Reports' },
      { code: 'settings:edit', name: 'Edit Settings' },
      { code: 'staff:manage', name: 'Manage Staff' },
      { code: 'crm:manage_credit', name: 'Manage Credit Accounts' },
      { code: 'drawer:manual_open', name: 'Open Cash Drawer Manually' },
    ];

    // Create permissions
    const created = [];
    for (const perm of permissionCodes) {
      const p = await tx.permission.create({
        data: { restaurantId, code: perm.code, name: perm.name },
      });
      created.push(p);
    }

    // Role-permission mapping (from ARCHITECTURE_DECISIONS.md Section 2)
    const rolePerms: Record<string, string[]> = {
      OWNER: permissionCodes.map((p) => p.code), // All permissions
      MANAGER: [
        'menu:view', 'menu:edit', 'menu:toggle_availability',
        'order:create', 'order:cancel', 'order:apply_discount',
        'order:set_priority', 'order:override_availability', 'order:complimentary',
        'bill:generate', 'bill:void', 'bill:reprint', 'bill:refund',
        'kot:view', 'kot:mark_ready',
        'inventory:view', 'inventory:edit',
        'reports:view', 'staff:manage', 'crm:manage_credit', 'drawer:manual_open',
      ],
      BILLER: [
        'menu:view', 'menu:toggle_availability',
        'order:create', 'order:apply_discount', 'order:set_priority',
        'bill:generate', 'bill:reprint',
        'kot:view',
      ],
      CAPTAIN: [
        'menu:view', 'order:create', 'kot:view',
      ],
      KITCHEN: [
        'menu:view', 'kot:view', 'kot:mark_ready',
      ],
    };

    for (const [role, codes] of Object.entries(rolePerms)) {
      for (const code of codes) {
        const perm = created.find((p) => p.code === code);
        if (perm) {
          await tx.rolePermission.create({
            data: {
              restaurantId,
              role: role as any,
              permissionId: perm.id,
            },
          });
        }
      }
    }
  }
}
