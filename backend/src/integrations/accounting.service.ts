import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  // ── P&L Report ────────────────────────────────────────────────────────────

  async getPnL(restaurantId: string, from: Date, to: Date) {
    const branches = await this.prisma.branch.findMany({
      where: { restaurantId },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);

    // Revenue: paid bills in date range
    const bills = await this.prisma.bill.findMany({
      where: {
        branchId: { in: branchIds },
        status:   'PAID',
        createdAt: { gte: from, lte: to },
        isVoid:   false,
      },
      include: { payments: true },
    });

    const revenue = {
      grossSales:   0,
      discounts:    0,
      netSales:     0,
      taxCollected: 0,
      charges:      0,
      tips:         0,
    };

    for (const b of bills) {
      revenue.grossSales   += Number(b.subtotal);
      revenue.discounts    += Number(b.discountTotal);
      revenue.netSales     += Number(b.subtotal) - Number(b.discountTotal);
      revenue.taxCollected += Number(b.taxTotal);
      revenue.charges      += Number(b.chargesTotal);
      revenue.tips         += Number(b.tipAmount);
    }

    // Payment method breakdown
    const allPayments = bills.flatMap((b) => b.payments);
    const byMethod: Record<string, number> = {};
    for (const p of allPayments) {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
    }

    // Refunds
    const refunds = await this.prisma.refund.findMany({
      where: {
        bill: { branchId: { in: branchIds } },
        status:    'COMPLETED',
        createdAt: { gte: from, lte: to },
      },
    });
    const totalRefunds = refunds.reduce((s, r) => s + Number(r.amount), 0);

    return {
      period: { from, to },
      revenue: {
        ...revenue,
        totalRefunds,
        netRevenue: revenue.netSales - totalRefunds,
      },
      byPaymentMethod: byMethod,
      billCount:   bills.length,
      refundCount: refunds.length,
    };
  }

  // ── Tally XML Export ──────────────────────────────────────────────────────
  // Generates a Tally Prime–compatible XML import file (TALLYMESSAGE format)
  // for the given date range. Each paid bill becomes a Sales Voucher entry.

  async exportTallyXml(restaurantId: string, from: Date, to: Date): Promise<string> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    const branches = await this.prisma.branch.findMany({
      where: { restaurantId },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);

    const bills = await this.prisma.bill.findMany({
      where: {
        branchId: { in: branchIds },
        status:   'PAID',
        isVoid:   false,
        createdAt: { gte: from, lte: to },
      },
      include: { order: { include: { items: true } }, payments: true },
    });

    const companyName = restaurant?.name ?? 'Restaurant';

    const vouchers = bills.map((bill) => {
      const date = bill.createdAt.toISOString().slice(0, 10).replace(/-/g, '');
      const amount = Number(bill.grandTotal).toFixed(2);
      const taxAmt = Number(bill.taxTotal).toFixed(2);
      const narration = `Bill ${bill.billNumber}`;

      return `
  <VOUCHER REMOTEID="${bill.id}" VCHTYPE="Sales" ACTION="Create">
    <DATE>${date}</DATE>
    <NARRATION>${narration}</NARRATION>
    <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
    <PARTYLEDGERNAME>Cash/Card Sales</PARTYLEDGERNAME>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Sales Account</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>-${Number(bill.subtotal).toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Output CGST</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>-${Number(bill.cgstAmount).toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Output SGST</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>-${Number(bill.sgstAmount).toFixed(2)}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Cash/Card Sales</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>${amount}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${vouchers.join('\n')}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  }
}
