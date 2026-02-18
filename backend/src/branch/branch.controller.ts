import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BranchService } from './branch.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@ApiTags('Branches')
@Controller('branches')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class BranchController {
  constructor(private branchService: BranchService) {}

  @Get()
  @ApiOperation({ summary: 'List all branches' })
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.branchService.findAll(user.restaurantId!);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get branch by ID' })
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.branchService.findOne(user.restaurantId!, id);
  }

  @Post()
  @Roles('OWNER')
  @ApiOperation({ summary: 'Create a new branch' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBranchDto) {
    return this.branchService.create(user.restaurantId!, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'Update a branch' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchService.update(user.restaurantId!, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER')
  @ApiOperation({ summary: 'Deactivate a branch' })
  async deactivate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.branchService.deactivate(user.restaurantId!, id);
  }
}
