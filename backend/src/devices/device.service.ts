import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../common/plan-limits.service';
import { RegisterDeviceDto, UpdateDeviceDto } from '../integrations/dto/integrations.dto';

@Injectable()
export class DeviceService {
  constructor(
    private prisma: PrismaService,
    private planLimits: PlanLimitsService,
  ) {}

  async register(restaurantId: string, registeredBy: string, dto: RegisterDeviceDto) {
    await this.planLimits.enforce(restaurantId, 'devices');
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, restaurantId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.device.create({
      data: {
        restaurantId,
        branchId:          dto.branchId,
        name:              dto.name,
        deviceFingerprint: dto.deviceFingerprint,
        registeredBy,
        lastSeen:          new Date(),
      },
    });
  }

  async list(restaurantId: string, branchId?: string) {
    return this.prisma.device.findMany({
      where: {
        restaurantId,
        ...(branchId ? { branchId } : {}),
      },
      include: { branch: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(restaurantId: string, id: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, restaurantId },
      include: { branch: { select: { name: true } } },
    });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async update(restaurantId: string, id: string, dto: UpdateDeviceDto) {
    await this.findOne(restaurantId, id);
    return this.prisma.device.update({
      where: { id },
      data:  dto,
    });
  }

  async heartbeat(restaurantId: string, id: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, restaurantId, isActive: true },
    });
    if (!device) throw new NotFoundException('Device not found or inactive');
    return this.prisma.device.update({
      where: { id },
      data:  { lastSeen: new Date() },
      select: { id: true, name: true, lastSeen: true },
    });
  }

  async revoke(restaurantId: string, id: string) {
    await this.findOne(restaurantId, id);
    return this.prisma.device.update({
      where: { id },
      data:  { isActive: false },
    });
  }

  async delete(restaurantId: string, id: string) {
    await this.findOne(restaurantId, id);
    return this.prisma.device.delete({ where: { id } });
  }
}
