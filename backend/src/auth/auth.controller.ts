import { Controller, Post, Body, UseGuards, Patch } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import {
  LoginDto,
  PinLoginDto,
  RegisterDto,
  RefreshTokenDto,
  ChangePasswordDto,
  RegisterDeviceDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SetPinDto,
} from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @Throttle({ login: { ttl: 900000, limit: process.env.NODE_ENV === 'development' ? 1000 : 50 } })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('pin-login')
  @ApiOperation({ summary: 'Login with 4-digit PIN (registered devices only)' })
  @Throttle({ login: { ttl: 900000, limit: process.env.NODE_ENV === 'development' ? 1000 : 50 } })
  async pinLogin(@Body() dto: PinLoginDto) {
    return this.authService.pinLogin(dto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new restaurant owner' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Patch('change-password')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.userId, dto);
  }

  @Post('register-device')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a POS device (Owner/Manager only)' })
  async registerDevice(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.authService.registerDevice(user.userId, dto);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token from email' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Patch('set-pin')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set or update 4-digit POS PIN' })
  async setPin(@CurrentUser() user: JwtPayload, @Body() dto: SetPinDto) {
    return this.authService.setPin(user.userId, dto.pin);
  }
}
