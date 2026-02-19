/**
 * Demo Restaurant Seeding Script
 * Creates 3 fully-configured demo restaurants for testing all operating modes.
 * Run: npx ts-node scripts/seed-demo-restaurants.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌟 RestroSync Demo Restaurant Seeder\n');

  // ─── 1. Get Super Admin & FREE plan ─────────────────────────────────────────

  const superAdmin = await prisma.user.findFirst({
    where: { email: 'admin@restrosync.com', role: 'SUPER_ADMIN' },
  });
  if (!superAdmin) {
    console.error('❌ Super Admin not found. Run the main seed script first.');
    process.exit(1);
  }

  let freePlan = await prisma.plan.findFirst({ where: { name: 'FREE' } });
  if (!freePlan) {
    freePlan = await prisma.plan.create({
      data: {
        name: 'FREE',
        maxBranches: 1,
        maxDevices: 2,
        maxStaff: 5,
        maxMenuItems: 100,
        priceMonthly: 0,
      },
    });
  }

  const password = 'Demo@123';
  const hashedPassword = await bcrypt.hash(password, 10);

  // ─── Helper: Create Restaurant ──────────────────────────────────────────────

  async function createRestaurant(
    name: string,
    operatingMode: 'COUNTER' | 'TABLE_SIMPLE' | 'FULL_SERVICE',
    ownerEmail: string,
    menuItems: Array<{ name: string; price: number; foodType: string; category: string }>,
    tableCount: number,
  ) {
    console.log(`\n📍 Creating: ${name} (${operatingMode} mode)`);

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        operatingMode,
        address: `${name} Address, Demo Street`,
        city: 'Bangalore',
        phone: '9876543210',
        gstin: '29ABCDE1234F1Z5',
        fssaiNumber: '12345678901234',
        planId: freePlan!.id,
      },
    });

    const branch = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: 'Main Branch',
        address: `${name} Main Branch, Demo Area`,
        phone: '9876543210',
      },
    });

    const owner = await prisma.user.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        name: `${name} Owner`,
        email: ownerEmail,
        password: hashedPassword,
        role: 'OWNER',
      },
    });

    // Create categories and menu items
    const categoryMap = new Map<string, string>();
    const uniqueCategories = [...new Set(menuItems.map((i) => i.category))];

    for (const catName of uniqueCategories) {
      const category = await prisma.category.create({
        data: { restaurantId: restaurant.id, name: catName },
      });
      categoryMap.set(catName, category.id);
    }

    await prisma.menuItem.createMany({
      data: menuItems.map((item) => ({
        restaurantId: restaurant.id,
        categoryId: categoryMap.get(item.category)!,
        name: item.name,
        price: item.price,
        foodType: item.foodType,
      })),
    });

    // Create tables (only if not COUNTER mode)
    if (operatingMode !== 'COUNTER') {
      await prisma.table.createMany({
        data: Array.from({ length: tableCount }, (_, i) => ({
          branchId: branch.id,
          number: String(i + 1),
          capacity: i % 3 === 0 ? 2 : i % 3 === 1 ? 4 : 6,
        })),
      });
    }

    // Mark onboarding as complete
    await prisma.onboardingProgress.create({
      data: {
        restaurantId: restaurant.id,
        modeSelected: true,
        menuAdded: true,
        isDismissed: true,
      },
    });

    console.log(`  ✓ Restaurant: ${restaurant.id}`);
    console.log(`  ✓ Branch: ${branch.id}`);
    console.log(`  ✓ Owner: ${owner.email}`);
    console.log(`  ✓ Menu items: ${menuItems.length}`);
    console.log(`  ✓ Tables: ${operatingMode === 'COUNTER' ? 'N/A (Counter mode)' : tableCount}`);

    return { restaurant, branch, owner };
  }

  // ─── 2. Gangaprabha Cafe — COUNTER mode ────────────────────────────────────

  await createRestaurant(
    'Gangaprabha Cafe',
    'COUNTER',
    'gangaprabha@demo.com',
    [
      { name: 'Filter Coffee', price: 30, foodType: 'VEG', category: 'Beverages' },
      { name: 'Masala Tea', price: 25, foodType: 'VEG', category: 'Beverages' },
      { name: 'Badam Milk', price: 60, foodType: 'VEG', category: 'Beverages' },
      { name: 'Cold Coffee', price: 80, foodType: 'VEG', category: 'Beverages' },
      { name: 'Idli (3 pcs)', price: 40, foodType: 'VEG', category: 'Breakfast' },
      { name: 'Vada (2 pcs)', price: 35, foodType: 'VEG', category: 'Breakfast' },
      { name: 'Masala Dosa', price: 70, foodType: 'VEG', category: 'Breakfast' },
      { name: 'Plain Dosa', price: 50, foodType: 'VEG', category: 'Breakfast' },
      { name: 'Onion Dosa', price: 60, foodType: 'VEG', category: 'Breakfast' },
      { name: 'Set Dosa (3 pcs)', price: 55, foodType: 'VEG', category: 'Breakfast' },
      { name: 'Upma', price: 45, foodType: 'VEG', category: 'Breakfast' },
      { name: 'Pongal', price: 50, foodType: 'VEG', category: 'Breakfast' },
      { name: 'Bonda (4 pcs)', price: 40, foodType: 'VEG', category: 'Snacks' },
      { name: 'Bajji Mix', price: 50, foodType: 'VEG', category: 'Snacks' },
      { name: 'Samosa (2 pcs)', price: 30, foodType: 'VEG', category: 'Snacks' },
      { name: 'Veg Puff', price: 25, foodType: 'VEG', category: 'Snacks' },
      { name: 'Gulab Jamun (2 pcs)', price: 40, foodType: 'VEG', category: 'Sweets' },
      { name: 'Jalebi (100g)', price: 60, foodType: 'VEG', category: 'Sweets' },
      { name: 'Mysore Pak (100g)', price: 80, foodType: 'VEG', category: 'Sweets' },
      { name: 'Laddu (2 pcs)', price: 50, foodType: 'VEG', category: 'Sweets' },
    ],
    0,
  );

  // ─── 3. Gurukrupa — TABLE_SIMPLE mode ──────────────────────────────────────

  await createRestaurant(
    'Gurukrupa',
    'TABLE_SIMPLE',
    'gurukrupa@demo.com',
    [
      { name: 'Paneer Butter Masala', price: 220, foodType: 'VEG', category: 'Main Course' },
      { name: 'Dal Tadka', price: 160, foodType: 'VEG', category: 'Main Course' },
      { name: 'Dal Makhani', price: 180, foodType: 'VEG', category: 'Main Course' },
      { name: 'Veg Kolhapuri', price: 200, foodType: 'VEG', category: 'Main Course' },
      { name: 'Mix Veg Curry', price: 170, foodType: 'VEG', category: 'Main Course' },
      { name: 'Palak Paneer', price: 210, foodType: 'VEG', category: 'Main Course' },
      { name: 'Chole Masala', price: 150, foodType: 'VEG', category: 'Main Course' },
      { name: 'Butter Naan', price: 50, foodType: 'VEG', category: 'Breads' },
      { name: 'Garlic Naan', price: 60, foodType: 'VEG', category: 'Breads' },
      { name: 'Tandoori Roti', price: 30, foodType: 'VEG', category: 'Breads' },
      { name: 'Laccha Paratha', price: 45, foodType: 'VEG', category: 'Breads' },
      { name: 'Kulcha', price: 55, foodType: 'VEG', category: 'Breads' },
      { name: 'Jeera Rice', price: 120, foodType: 'VEG', category: 'Rice' },
      { name: 'Veg Pulao', price: 150, foodType: 'VEG', category: 'Rice' },
      { name: 'Veg Biryani', price: 180, foodType: 'VEG', category: 'Rice' },
      { name: 'Curd Rice', price: 80, foodType: 'VEG', category: 'Rice' },
      { name: 'Raita', price: 50, foodType: 'VEG', category: 'Sides' },
      { name: 'Green Salad', price: 60, foodType: 'VEG', category: 'Sides' },
      { name: 'Papad Roasted', price: 20, foodType: 'VEG', category: 'Sides' },
      { name: 'Lassi Sweet', price: 70, foodType: 'VEG', category: 'Beverages' },
      { name: 'Buttermilk', price: 40, foodType: 'VEG', category: 'Beverages' },
      { name: 'Fresh Lime Soda', price: 50, foodType: 'VEG', category: 'Beverages' },
      { name: 'Ice Cream (Vanilla)', price: 80, foodType: 'VEG', category: 'Desserts' },
      { name: 'Gulab Jamun (2 pcs)', price: 60, foodType: 'VEG', category: 'Desserts' },
      { name: 'Rasmalai (2 pcs)', price: 90, foodType: 'VEG', category: 'Desserts' },
    ],
    12,
  );

  // ─── 4. Cosmo Kadai — FULL_SERVICE mode ────────────────────────────────────

  await createRestaurant(
    'Cosmo Kadai',
    'FULL_SERVICE',
    'cosmo@demo.com',
    [
      { name: 'Chicken Biryani', price: 280, foodType: 'NON_VEG', category: 'Biryani' },
      { name: 'Mutton Biryani', price: 350, foodType: 'NON_VEG', category: 'Biryani' },
      { name: 'Veg Biryani', price: 200, foodType: 'VEG', category: 'Biryani' },
      { name: 'Egg Biryani', price: 180, foodType: 'EGG', category: 'Biryani' },
      { name: 'Chicken 65', price: 240, foodType: 'NON_VEG', category: 'Starters' },
      { name: 'Chicken Lollipop', price: 260, foodType: 'NON_VEG', category: 'Starters' },
      { name: 'Paneer Tikka', price: 220, foodType: 'VEG', category: 'Starters' },
      { name: 'Gobi Manchurian', price: 180, foodType: 'VEG', category: 'Starters' },
      { name: 'Mushroom Pepper Fry', price: 200, foodType: 'VEG', category: 'Starters' },
      { name: 'Fish Finger', price: 280, foodType: 'NON_VEG', category: 'Starters' },
      { name: 'Prawn Fry', price: 320, foodType: 'NON_VEG', category: 'Starters' },
      { name: 'Butter Chicken', price: 300, foodType: 'NON_VEG', category: 'Main Course' },
      { name: 'Chicken Curry', price: 260, foodType: 'NON_VEG', category: 'Main Course' },
      { name: 'Mutton Rogan Josh', price: 380, foodType: 'NON_VEG', category: 'Main Course' },
      { name: 'Fish Curry', price: 290, foodType: 'NON_VEG', category: 'Main Course' },
      { name: 'Prawn Masala', price: 350, foodType: 'NON_VEG', category: 'Main Course' },
      { name: 'Paneer Butter Masala', price: 240, foodType: 'VEG', category: 'Main Course' },
      { name: 'Dal Makhani', price: 180, foodType: 'VEG', category: 'Main Course' },
      { name: 'Veg Kolhapuri', price: 200, foodType: 'VEG', category: 'Main Course' },
      { name: 'Garlic Naan', price: 60, foodType: 'VEG', category: 'Breads' },
      { name: 'Butter Naan', price: 50, foodType: 'VEG', category: 'Breads' },
      { name: 'Tandoori Roti', price: 30, foodType: 'VEG', category: 'Breads' },
      { name: 'Kulcha', price: 55, foodType: 'VEG', category: 'Breads' },
      { name: 'Jeera Rice', price: 120, foodType: 'VEG', category: 'Rice' },
      { name: 'Veg Fried Rice', price: 150, foodType: 'VEG', category: 'Rice' },
      { name: 'Chicken Fried Rice', price: 180, foodType: 'NON_VEG', category: 'Rice' },
      { name: 'Schezwan Fried Rice', price: 170, foodType: 'VEG', category: 'Rice' },
      { name: 'Hakka Noodles Veg', price: 140, foodType: 'VEG', category: 'Noodles' },
      { name: 'Hakka Noodles Chicken', price: 170, foodType: 'NON_VEG', category: 'Noodles' },
      { name: 'Schezwan Noodles', price: 160, foodType: 'VEG', category: 'Noodles' },
      { name: 'Green Salad', price: 80, foodType: 'VEG', category: 'Sides' },
      { name: 'Raita', price: 60, foodType: 'VEG', category: 'Sides' },
      { name: 'Papad Roasted', price: 25, foodType: 'VEG', category: 'Sides' },
      { name: 'Coke (300ml)', price: 40, foodType: 'VEG', category: 'Beverages' },
      { name: 'Fresh Lime Soda', price: 60, foodType: 'VEG', category: 'Beverages' },
      { name: 'Watermelon Juice', price: 80, foodType: 'VEG', category: 'Beverages' },
      { name: 'Mango Lassi', price: 90, foodType: 'VEG', category: 'Beverages' },
      { name: 'Gulab Jamun (2 pcs)', price: 60, foodType: 'VEG', category: 'Desserts' },
      { name: 'Ice Cream (2 scoops)', price: 100, foodType: 'VEG', category: 'Desserts' },
      { name: 'Brownie with Ice Cream', price: 140, foodType: 'EGG', category: 'Desserts' },
    ],
    20,
  );

  // ─── Summary ────────────────────────────────────────────────────────────────

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('✅ Demo Restaurants Created Successfully!');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('🔐 CREDENTIALS\n');
  console.log('Super Admin:');
  console.log('  Email:    admin@restrosync.com');
  console.log('  Password: Admin@123\n');

  console.log('Restaurant #1 — Gangaprabha Cafe (COUNTER mode):');
  console.log('  Email:    gangaprabha@demo.com');
  console.log('  Password: Demo@123');
  console.log('  Features: Token-based billing, no tables, fast counter service\n');

  console.log('Restaurant #2 — Gurukrupa (TABLE_SIMPLE mode):');
  console.log('  Email:    gurukrupa@demo.com');
  console.log('  Password: Demo@123');
  console.log('  Features: 12 tables, basic table service, no captain/KOT\n');

  console.log('Restaurant #3 — Cosmo Kadai (FULL_SERVICE mode):');
  console.log('  Email:    cosmo@demo.com');
  console.log('  Password: Demo@123');
  console.log('  Features: 20 tables, full KOT workflow, kitchen stations, reservations\n');

  console.log('🌐 Frontend URL: http://localhost:5173');
  console.log('🔗 Super Admin URL: http://localhost:5173/super-admin/login\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
