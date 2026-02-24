import {
  Controller, Post, Get, Patch,
  Param, Body, Query, UseGuards,
  DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { ComplaintsService } from './complaints.service';
import { FileComplaintDto, ResolveComplaintDto } from './dto/complaint.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('orders/:orderId/complaints')
export class ComplaintsController {
  constructor(private svc: ComplaintsService) {}

  // POST /orders/:orderId/complaints
  @Post()
  file(
    @Param('orderId') orderId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: FileComplaintDto,
  ) {
    return this.svc.fileComplaint(
      orderId,
      user.branchId!,
      user.restaurantId!,
      user.userId,
      dto,
    );
  }

  // GET /orders/:orderId/complaints
  @Get()
  listForOrder(@Param('orderId') orderId: string, @CurrentUser() user: JwtPayload) {
    // Scope to branch — reuse list with a short window
    return this.svc.list(user.branchId!, undefined, undefined, 1, 100);
  }
}

// ── Standalone analytics + branch-level list ──────────────────────────────────

@UseGuards(AuthGuard('jwt'))
@Controller('complaints')
export class ComplaintsAnalyticsController {
  constructor(private svc: ComplaintsService) {}

  // GET /complaints  — branch-level recent list
  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('from')  from?: string,
    @Query('to')    to?:   string,
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page?:  number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit?: number,
  ) {
    return this.svc.list(user.branchId!, from, to, page, limit);
  }

  // GET /complaints/analytics  — owner dashboard
  @Get('analytics')
  analytics(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to')   to?:   string,
  ) {
    return this.svc.analytics(user.restaurantId!, from, to);
  }

  // PATCH /complaints/:id/resolve
  @Patch(':id/resolve')
  resolve(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ResolveComplaintDto,
  ) {
    return this.svc.resolve(id, user.branchId!, dto);
  }
}
