import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchService {
  constructor(private prisma: PrismaService) {}

  async findAll(restaurantId: string) {
    return this.prisma.branch.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(restaurantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, restaurantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async create(restaurantId: string, dto: CreateBranchDto) {
    return this.prisma.branch.create({
      data: { restaurantId, ...dto },
    });
  }

  async update(restaurantId: string, branchId: string, dto: UpdateBranchDto) {
    await this.findOne(restaurantId, branchId);
    return this.prisma.branch.update({
      where: { id: branchId },
      data: dto,
    });
  }

  async deactivate(restaurantId: string, branchId: string) {
    await this.findOne(restaurantId, branchId);
    return this.prisma.branch.update({
      where: { id: branchId },
      data: { isActive: false },
    });
  }
}
