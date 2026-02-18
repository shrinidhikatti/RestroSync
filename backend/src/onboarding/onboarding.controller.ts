import { Controller, Get, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { ImportTemplateDto, UpdateOnboardingProgressDto } from './dto/onboarding.dto';

@ApiTags('Onboarding')
@Controller('onboarding')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Get('progress')
  @ApiOperation({ summary: 'Get onboarding progress' })
  async getProgress(@CurrentUser() user: JwtPayload) {
    return this.onboardingService.getProgress(user.restaurantId!);
  }

  @Patch('progress')
  @ApiOperation({ summary: 'Update onboarding progress' })
  async updateProgress(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateOnboardingProgressDto,
  ) {
    return this.onboardingService.updateProgress(user.restaurantId!, dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List available menu templates' })
  async getTemplates() {
    return this.onboardingService.getTemplates();
  }

  @Post('import-template')
  @ApiOperation({ summary: 'Import a menu template' })
  async importTemplate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImportTemplateDto,
  ) {
    return this.onboardingService.importTemplate(user.restaurantId!, dto);
  }
}
