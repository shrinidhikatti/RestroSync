import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { TableService } from './table.service';
import { ReservationService } from './reservation.service';
import {
  CreateTableDto,
  UpdateTableDto,
  UpdateTableStatusDto,
  CreateReservationDto,
  UpdateReservationDto,
} from './dto/table.dto';

@ApiTags('Tables & Reservations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller()
export class TableController {
  constructor(
    private readonly tableService: TableService,
    private readonly reservationService: ReservationService,
  ) {}

  // ─── Tables ───────────────────────────────────────────────────

  @Get('tables')
  @ApiOperation({ summary: 'List all tables for branch (with active order and reservation info)' })
  getTables(@CurrentUser() user: JwtPayload) {
    return this.tableService.getAll(user.branchId!);
  }

  @Get('tables/:id')
  @ApiOperation({ summary: 'Get table detail with active orders' })
  getTable(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tableService.getOne(user.branchId!, id);
  }

  @Post('tables')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Create table' })
  createTable(@CurrentUser() user: JwtPayload, @Body() dto: CreateTableDto) {
    return this.tableService.create(user.branchId!, dto);
  }

  @Patch('tables/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update table details' })
  updateTable(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.tableService.update(user.branchId!, id, dto);
  }

  @Patch('tables/:id/status')
  @Roles('OWNER', 'MANAGER', 'CAPTAIN', 'BILLER')
  @ApiOperation({ summary: 'Update table status' })
  updateTableStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
  ) {
    return this.tableService.updateStatus(user.branchId!, id, dto);
  }

  @Delete('tables/:id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Deactivate table (soft delete)' })
  deleteTable(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tableService.delete(user.branchId!, id);
  }

  // ─── Reservations ─────────────────────────────────────────────

  @Get('reservations')
  @ApiOperation({ summary: 'List reservations' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter by date (YYYY-MM-DD)' })
  getReservations(@CurrentUser() user: JwtPayload, @Query('date') date?: string) {
    return this.reservationService.getAll(user.branchId!, date);
  }

  @Get('reservations/:id')
  @ApiOperation({ summary: 'Get reservation detail' })
  getReservation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reservationService.getOne(user.branchId!, id);
  }

  @Post('reservations')
  @Roles('OWNER', 'MANAGER', 'CAPTAIN', 'BILLER')
  @ApiOperation({ summary: 'Create reservation' })
  createReservation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationService.create(user.branchId!, user.userId!, dto);
  }

  @Patch('reservations/:id')
  @Roles('OWNER', 'MANAGER', 'CAPTAIN', 'BILLER')
  @ApiOperation({ summary: 'Update reservation' })
  updateReservation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationService.update(user.branchId!, id, dto);
  }

  @Patch('reservations/:id/cancel')
  @Roles('OWNER', 'MANAGER', 'CAPTAIN', 'BILLER')
  @ApiOperation({ summary: 'Cancel reservation' })
  cancelReservation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reservationService.cancel(user.branchId!, id);
  }

  @Patch('reservations/:id/seat')
  @Roles('OWNER', 'MANAGER', 'CAPTAIN', 'BILLER')
  @ApiOperation({ summary: 'Seat a confirmed reservation (marks table OCCUPIED)' })
  seatReservation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.reservationService.seat(user.branchId!, id);
  }
}
