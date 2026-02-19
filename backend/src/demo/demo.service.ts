import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DemoService {
  constructor(private prisma: PrismaService) {}

  async seed(restaurantId: string, branchId: string) {
    const existing = await this.prisma.menuItem.count({
      where: { restaurantId, name: { startsWith: '[DEMO]' } },
    });
    if (existing > 0) throw new BadRequestException('Demo data already seeded. Wipe first.');

    // Get or create a default category
    let category = await this.prisma.category.findFirst({ where: { restaurantId } });
    if (!category) {
      category = await this.prisma.category.create({
        data: { restaurantId, name: 'Demo Category' },
      });
    }

    // Seed 30 menu items
    const demoItems = [
      { name: '[DEMO] Masala Dosa',        price: 89,  foodType: 'VEG' },
      { name: '[DEMO] Idli Sambar',         price: 65,  foodType: 'VEG' },
      { name: '[DEMO] Vada',                price: 45,  foodType: 'VEG' },
      { name: '[DEMO] Upma',                price: 55,  foodType: 'VEG' },
      { name: '[DEMO] Pongal',              price: 70,  foodType: 'VEG' },
      { name: '[DEMO] Chole Bhature',       price: 120, foodType: 'VEG' },
      { name: '[DEMO] Paneer Butter Masala',price: 220, foodType: 'VEG' },
      { name: '[DEMO] Dal Makhani',         price: 180, foodType: 'VEG' },
      { name: '[DEMO] Jeera Rice',          price: 120, foodType: 'VEG' },
      { name: '[DEMO] Butter Naan',         price: 45,  foodType: 'VEG' },
      { name: '[DEMO] Chicken Biryani',     price: 280, foodType: 'NON_VEG' },
      { name: '[DEMO] Mutton Curry',        price: 380, foodType: 'NON_VEG' },
      { name: '[DEMO] Fish Fry',            price: 320, foodType: 'NON_VEG' },
      { name: '[DEMO] Prawn Masala',        price: 400, foodType: 'NON_VEG' },
      { name: '[DEMO] Egg Bhurji',          price: 120, foodType: 'EGG' },
      { name: '[DEMO] Veg Burger',          price: 150, foodType: 'VEG' },
      { name: '[DEMO] Chicken Sandwich',    price: 180, foodType: 'NON_VEG' },
      { name: '[DEMO] French Fries',        price: 130, foodType: 'VEG' },
      { name: "[DEMO] Veg Pizza (7\")",     price: 250, foodType: 'VEG' },
      { name: "[DEMO] Chicken Pizza (7\")", price: 320, foodType: 'NON_VEG' },
      { name: '[DEMO] Cold Coffee',         price: 110, foodType: 'VEG' },
      { name: '[DEMO] Mango Lassi',         price: 90,  foodType: 'VEG' },
      { name: '[DEMO] Masala Chai',         price: 30,  foodType: 'VEG' },
      { name: '[DEMO] Fresh Lime Soda',     price: 60,  foodType: 'VEG' },
      { name: '[DEMO] Watermelon Juice',    price: 70,  foodType: 'VEG' },
      { name: '[DEMO] Gulab Jamun',         price: 60,  foodType: 'VEG' },
      { name: '[DEMO] Rasgulla',            price: 55,  foodType: 'VEG' },
      { name: '[DEMO] Ice Cream (Vanilla)', price: 80,  foodType: 'VEG' },
      { name: '[DEMO] Kheer',               price: 75,  foodType: 'VEG' },
      { name: '[DEMO] Halwa',               price: 65,  foodType: 'VEG' },
    ];

    await this.prisma.menuItem.createMany({
      data: demoItems.map((item) => ({
        restaurantId,
        categoryId: category!.id,
        name:       item.name,
        price:      item.price,
        foodType:   item.foodType,
      })),
    });

    // Seed 8 tables
    await this.prisma.table.createMany({
      data: Array.from({ length: 8 }, (_, i) => ({
        branchId,                      // Table has branchId, not restaurantId
        number:   String(i + 1),       // number is String in schema
        capacity: i < 4 ? 2 : 4,
      })),
      skipDuplicates: true,
    });

    // Seed 5 completed orders
    const tables   = await this.prisma.table.findMany({ where: { branchId }, take: 5 });
    const menuItems = await this.prisma.menuItem.findMany({
      where: { restaurantId, name: { startsWith: '[DEMO]' } },
      take: 10,
    });

    const today    = new Date();
    const systemUserId = 'system-demo';

    for (let i = 0; i < 5; i++) {
      const item1     = menuItems[i * 2 % menuItems.length];
      const item2     = menuItems[(i * 2 + 1) % menuItems.length];
      const price1    = Number(item1.price);
      const price2    = Number(item2.price);
      const subtotal  = price1 * 2 + price2;
      const grandTotal = subtotal;

      const order = await this.prisma.order.create({
        data: {
          branchId,
          tableId:      tables[i]?.id,
          orderType:    'DINE_IN',
          status:       'COMPLETED',
          businessDate: today,
          subtotal,
          grandTotal,
          createdBy:    systemUserId,
          items: {
            create: [
              {
                menuItemId: item1.id,
                itemName:   item1.name,
                unitPrice:  price1,
                quantity:   2,
                taxPercent: 0,
                status:     'SERVED',
              },
              {
                menuItemId: item2.id,
                itemName:   item2.name,
                unitPrice:  price2,
                quantity:   1,
                taxPercent: 0,
                status:     'SERVED',
              },
            ],
          },
        },
      });

      const bill = await this.prisma.bill.create({
        data: {
          branchId,
          orderId:    order.id,
          billNumber: `DEMO/INV/${String(i + 1).padStart(5, '0')}`,
          subtotal,
          taxTotal:   0,
          grandTotal,
          status:     'PAID',
          createdBy:  systemUserId,
        },
      });

      await this.prisma.payment.create({
        data: {
          billId:    bill.id,
          orderId:   order.id,
          method:    'CASH',
          amount:    grandTotal,
          status:    'COMPLETED',
          createdBy: systemUserId,
        },
      });
    }

    return {
      message: 'Demo data seeded successfully.',
      seeded: { menuItems: 30, tables: 8, orders: 5 },
    };
  }

  async wipe(restaurantId: string) {
    const demoItems = await this.prisma.menuItem.findMany({
      where: { restaurantId, name: { startsWith: '[DEMO]' } },
      select: { id: true },
    });

    const demoBills = await this.prisma.bill.findMany({
      where: { billNumber: { startsWith: 'DEMO/' }, order: { branch: { restaurantId } } },
      select: { id: true, orderId: true },
    });

    for (const bill of demoBills) {
      await this.prisma.payment.deleteMany({ where: { billId: bill.id } });
      await this.prisma.bill.delete({ where: { id: bill.id } });
      await this.prisma.orderItem.deleteMany({ where: { orderId: bill.orderId } });
      await this.prisma.order.delete({ where: { id: bill.orderId } });
    }

    if (demoItems.length > 0) {
      await this.prisma.menuItem.deleteMany({
        where: { id: { in: demoItems.map((i) => i.id) } },
      });
    }

    return { message: 'Demo data wiped successfully.' };
  }
}
