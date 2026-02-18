import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTaxGroupDto,
  UpdateTaxGroupDto,
  UpdateTaxSettingsDto,
  CreateChargeConfigDto,
  UpdateChargeConfigDto,
} from './dto/tax.dto';

@Injectable()
export class TaxService {
  constructor(private prisma: PrismaService) {}

  // ─── Tax Groups ───────────────────────────────────────────────

  async getTaxGroups(restaurantId: string) {
    return this.prisma.taxGroup.findMany({
      where: { restaurantId },
      include: { components: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getTaxGroup(restaurantId: string, id: string) {
    const group = await this.prisma.taxGroup.findFirst({
      where: { id, restaurantId },
      include: { components: true },
    });
    if (!group) throw new NotFoundException('Tax group not found');
    return group;
  }

  async createTaxGroup(restaurantId: string, dto: CreateTaxGroupDto) {
    const existing = await this.prisma.taxGroup.findFirst({
      where: { restaurantId, name: dto.name },
    });
    if (existing) throw new ConflictException('Tax group with this name already exists');

    return this.prisma.taxGroup.create({
      data: {
        restaurantId,
        name: dto.name,
        components: {
          create: dto.components.map((c) => ({ type: c.type, rate: c.rate, name: c.type })),
        },
      },
      include: { components: true },
    });
  }

  async updateTaxGroup(restaurantId: string, id: string, dto: UpdateTaxGroupDto) {
    await this.getTaxGroup(restaurantId, id);

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.components !== undefined) {
      // Replace all components
      await this.prisma.taxComponent.deleteMany({ where: { taxGroupId: id } });
      data.components = {
        create: dto.components.map((c) => ({ type: c.type, rate: c.rate, name: c.type })),
      };
    }

    return this.prisma.taxGroup.update({
      where: { id },
      data,
      include: { components: true },
    });
  }

  async deleteTaxGroup(restaurantId: string, id: string) {
    await this.getTaxGroup(restaurantId, id);

    // Check if any menu items reference this tax group
    const usedBy = await this.prisma.menuItem.count({
      where: { restaurantId, taxGroupId: id },
    });
    if (usedBy > 0) {
      throw new BadRequestException(
        `Cannot delete: ${usedBy} menu item(s) use this tax group`,
      );
    }

    await this.prisma.taxGroup.delete({ where: { id } });
    return { message: 'Tax group deleted' };
  }

  // ─── Tax Settings ─────────────────────────────────────────────

  async updateTaxSettings(restaurantId: string, dto: UpdateTaxSettingsDto) {
    const restaurant = await this.prisma.restaurant.update({
      where: { id: restaurantId },
      data: { taxInclusive: dto.taxInclusive },
      select: { id: true, taxInclusive: true },
    });
    return restaurant;
  }

  // ─── Charge Configs ───────────────────────────────────────────

  async getChargeConfigs(restaurantId: string) {
    return this.prisma.chargeConfig.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createChargeConfig(restaurantId: string, dto: CreateChargeConfigDto) {
    return this.prisma.chargeConfig.create({
      data: {
        restaurantId,
        name: dto.name,
        type: dto.type,
        value: dto.value,
        isActive: dto.isActive ?? true,
        applicableTo: dto.dineInOnly ? 'DINE_IN' : 'ALL',
      },
    });
  }

  async updateChargeConfig(
    restaurantId: string,
    id: string,
    dto: UpdateChargeConfigDto,
  ) {
    const config = await this.prisma.chargeConfig.findFirst({
      where: { id, restaurantId },
    });
    if (!config) throw new NotFoundException('Charge config not found');

    const { dineInOnly, ...rest } = dto;
    const updateData: any = { ...rest };
    if (dineInOnly !== undefined) {
      updateData.applicableTo = dineInOnly ? 'DINE_IN' : 'ALL';
    }

    return this.prisma.chargeConfig.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteChargeConfig(restaurantId: string, id: string) {
    const config = await this.prisma.chargeConfig.findFirst({
      where: { id, restaurantId },
    });
    if (!config) throw new NotFoundException('Charge config not found');

    await this.prisma.chargeConfig.delete({ where: { id } });
    return { message: 'Charge config deleted' };
  }
}
