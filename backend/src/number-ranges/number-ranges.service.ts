import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type RangeType = 'BILL' | 'KOT';

@Injectable()
export class NumberRangesService {
  constructor(private readonly prisma: PrismaService) {}

  private getFinancialYear(): string {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed; March = 2, April = 3
    const year = now.getFullYear();
    // FY April-March: month >= 3 (April) → FY starts current year
    if (month >= 3) {
      return `${year}${year + 1}`;
    } else {
      return `${year - 1}${year}`;
    }
  }

  /** List all number ranges allocated to devices in this branch */
  async listRanges(branchId: string) {
    const fy = this.getFinancialYear();
    const ranges = await this.prisma.numberRange.findMany({
      where: { branchId, financialYear: fy },
      orderBy: { createdAt: 'desc' },
    });
    return { financialYear: fy, ranges };
  }

  /**
   * Allocate a block of numbers to a device for offline use.
   * The block size is configurable (default 50).
   * Returns rangeStart, rangeEnd so the device can use them offline
   * without hitting the server for each bill/KOT.
   */
  async allocate(
    branchId: string,
    deviceId: string,
    type: RangeType,
    blockSize: number = 50,
  ) {
    if (!['BILL', 'KOT'].includes(type)) {
      throw new BadRequestException({
        errorCode: 'INVALID_RANGE_TYPE',
        userMessage: 'type must be BILL or KOT.',
      });
    }
    if (blockSize < 1 || blockSize > 200) {
      throw new BadRequestException({
        errorCode: 'INVALID_BLOCK_SIZE',
        userMessage: 'blockSize must be between 1 and 200.',
      });
    }

    const fy = this.getFinancialYear();

    // Find the highest rangeEnd for this branch+type+FY to avoid overlap
    const last = await this.prisma.numberRange.findFirst({
      where: { branchId, type, financialYear: fy },
      orderBy: { rangeEnd: 'desc' },
      select: { rangeEnd: true },
    });

    const rangeStart = (last?.rangeEnd ?? 0) + 1;
    const rangeEnd = rangeStart + blockSize - 1;

    const range = await this.prisma.numberRange.create({
      data: {
        branchId,
        deviceId,
        type,
        rangeStart,
        rangeEnd,
        currentNumber: rangeStart,
        financialYear: fy,
      },
    });

    return {
      message: `Allocated ${blockSize} ${type} numbers for offline use.`,
      rangeId: range.id,
      type,
      financialYear: fy,
      rangeStart,
      rangeEnd,
      blockSize,
    };
  }

  /**
   * Acknowledge that numbers have been used — update currentNumber.
   * The device calls this when syncing back online.
   */
  async acknowledge(rangeId: string, usedUpTo: number) {
    const range = await this.prisma.numberRange.findUnique({
      where: { id: rangeId },
    });
    if (!range) {
      throw new BadRequestException({
        errorCode: 'RANGE_NOT_FOUND',
        userMessage: 'Number range not found.',
      });
    }
    if (usedUpTo < range.rangeStart || usedUpTo > range.rangeEnd) {
      throw new BadRequestException({
        errorCode: 'OUT_OF_RANGE',
        userMessage: `usedUpTo must be between ${range.rangeStart} and ${range.rangeEnd}.`,
      });
    }

    const updated = await this.prisma.numberRange.update({
      where: { id: rangeId },
      data: { currentNumber: usedUpTo },
    });

    return {
      rangeId: updated.id,
      currentNumber: updated.currentNumber,
      remaining: updated.rangeEnd - updated.currentNumber,
    };
  }
}
