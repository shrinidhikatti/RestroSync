/**
 * seed-demo.ts
 * Creates 3 fully-populated demo restaurants — one per operating mode.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-demo.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const PASS = 'Demo@1234';

// ─── Module defaults ──────────────────────────────────────────────────────────

const MODULE_DEFAULTS: Record<string, string[]> = {
  COUNTER: ['KDS', 'INVENTORY', 'CRM', 'ONLINE_ORDERS', 'DEVICES', 'ACCOUNTING', 'DAY_CLOSE'],
  TABLE_SIMPLE: ['TABLES', 'KDS', 'INVENTORY', 'CRM', 'ONLINE_ORDERS', 'DEVICES', 'ACCOUNTING', 'DAY_CLOSE'],
  FULL_SERVICE: ['TABLES', 'RESERVATIONS', 'KDS', 'INVENTORY', 'CRM', 'ONLINE_ORDERS',
    'MULTI_OUTLET', 'DEVICES', 'ACCOUNTING', 'DAY_CLOSE'],
};

// ─── Menu data ────────────────────────────────────────────────────────────────

const COUNTER_MENU = [
  {
    category: 'Burgers & Wraps',
    items: [
      { name: 'Veg Burger',     price: 99,  foodType: 'VEG'     },
      { name: 'Chicken Burger', price: 139, foodType: 'NON_VEG' },
      { name: 'Paneer Roll',    price: 119, foodType: 'VEG'     },
      { name: 'Chicken Roll',   price: 149, foodType: 'NON_VEG' },
      { name: 'Egg Roll',       price: 99,  foodType: 'EGG'     },
    ],
  },
  {
    category: 'Rice & Combos',
    items: [
      { name: 'Veg Fried Rice',     price: 120, foodType: 'VEG'     },
      { name: 'Chicken Fried Rice', price: 160, foodType: 'NON_VEG' },
      { name: 'Veg Noodles',        price: 110, foodType: 'VEG'     },
      { name: 'Burger + Fries Combo', price: 179, foodType: 'VEG'   },
      { name: 'Meal Box (Chicken)', price: 229, foodType: 'NON_VEG' },
    ],
  },
  {
    category: 'Sides & Snacks',
    items: [
      { name: 'French Fries',    price: 79,  foodType: 'VEG' },
      { name: 'Masala Fries',    price: 89,  foodType: 'VEG' },
      { name: 'Onion Rings',     price: 79,  foodType: 'VEG' },
      { name: 'Samosa (2 pcs)',  price: 30,  foodType: 'VEG' },
      { name: 'Veg Puff',        price: 25,  foodType: 'VEG' },
    ],
  },
  {
    category: 'Beverages',
    items: [
      { name: 'Cold Coffee',       price: 99,  foodType: 'VEG' },
      { name: 'Mango Lassi',       price: 79,  foodType: 'VEG' },
      { name: 'Fresh Lime Soda',   price: 49,  foodType: 'VEG' },
      { name: 'Masala Chai',       price: 25,  foodType: 'VEG' },
      { name: 'Mineral Water',     price: 20,  foodType: 'VEG' },
    ],
  },
];

const TABLE_SIMPLE_MENU = [
  {
    category: 'Dosa',
    items: [
      { name: 'Plain Dosa',         price: 55,  foodType: 'VEG' },
      { name: 'Masala Dosa',        price: 75,  foodType: 'VEG' },
      { name: 'Mysore Masala Dosa', price: 85,  foodType: 'VEG' },
      { name: 'Rava Dosa',          price: 80,  foodType: 'VEG' },
      { name: 'Onion Dosa',         price: 70,  foodType: 'VEG' },
      { name: 'Set Dosa (3 pcs)',   price: 65,  foodType: 'VEG' },
    ],
  },
  {
    category: 'Idli & Vada',
    items: [
      { name: 'Idli (2 pcs)',       price: 40,  foodType: 'VEG' },
      { name: 'Medu Vada (2 pcs)',  price: 45,  foodType: 'VEG' },
      { name: 'Idli Vada Combo',    price: 70,  foodType: 'VEG' },
      { name: 'Mini Idli (6 pcs)',  price: 55,  foodType: 'VEG' },
    ],
  },
  {
    category: 'Rice & Meals',
    items: [
      { name: 'Sambar Rice',        price: 60,  foodType: 'VEG' },
      { name: 'Curd Rice',          price: 55,  foodType: 'VEG' },
      { name: 'Lemon Rice',         price: 60,  foodType: 'VEG' },
      { name: 'Bisi Bele Bath',     price: 70,  foodType: 'VEG' },
      { name: 'South Indian Meals', price: 120, foodType: 'VEG' },
      { name: 'Pongal',             price: 55,  foodType: 'VEG' },
    ],
  },
  {
    category: 'Beverages',
    items: [
      { name: 'Filter Coffee',  price: 20, foodType: 'VEG' },
      { name: 'Tea',            price: 15, foodType: 'VEG' },
      { name: 'Badam Milk',     price: 35, foodType: 'VEG' },
      { name: 'Buttermilk',     price: 20, foodType: 'VEG' },
      { name: 'Fresh Juice',    price: 45, foodType: 'VEG' },
    ],
  },
];

const FULL_SERVICE_MENU = [
  {
    category: 'Starters',
    items: [
      { name: 'Paneer Tikka',        price: 280, foodType: 'VEG'     },
      { name: 'Chicken Tikka',       price: 320, foodType: 'NON_VEG' },
      { name: 'Hara Bhara Kebab',    price: 240, foodType: 'VEG'     },
      { name: 'Fish Fry',            price: 380, foodType: 'NON_VEG' },
      { name: 'Tandoori Chicken (½)',price: 420, foodType: 'NON_VEG' },
      { name: 'Veg Seekh Kebab',     price: 260, foodType: 'VEG'     },
    ],
  },
  {
    category: 'Curries',
    items: [
      { name: 'Paneer Butter Masala', price: 320, foodType: 'VEG'     },
      { name: 'Dal Makhani',          price: 260, foodType: 'VEG'     },
      { name: 'Butter Chicken',       price: 380, foodType: 'NON_VEG' },
      { name: 'Palak Paneer',         price: 300, foodType: 'VEG'     },
      { name: 'Chicken Curry',        price: 360, foodType: 'NON_VEG' },
      { name: 'Chole Masala',         price: 240, foodType: 'VEG'     },
      { name: 'Mutton Rogan Josh',    price: 480, foodType: 'NON_VEG' },
    ],
  },
  {
    category: 'Breads',
    items: [
      { name: 'Butter Naan',    price: 60,  foodType: 'VEG' },
      { name: 'Garlic Naan',    price: 70,  foodType: 'VEG' },
      { name: 'Tandoori Roti',  price: 40,  foodType: 'VEG' },
      { name: 'Laccha Paratha', price: 80,  foodType: 'VEG' },
    ],
  },
  {
    category: 'Rice & Biryani',
    items: [
      { name: 'Jeera Rice',        price: 160, foodType: 'VEG'     },
      { name: 'Veg Biryani',       price: 280, foodType: 'VEG'     },
      { name: 'Chicken Biryani',   price: 380, foodType: 'NON_VEG' },
      { name: 'Mutton Biryani',    price: 480, foodType: 'NON_VEG' },
    ],
  },
  {
    category: 'Beverages',
    items: [
      { name: 'Fresh Lime Soda',  price: 80,  foodType: 'VEG' },
      { name: 'Mango Lassi',      price: 120, foodType: 'VEG' },
      { name: 'Masala Chai',      price: 60,  foodType: 'VEG' },
      { name: 'Cold Coffee',      price: 160, foodType: 'VEG' },
      { name: 'Mineral Water',    price: 40,  foodType: 'VEG' },
    ],
  },
  {
    category: 'Desserts',
    items: [
      { name: 'Gulab Jamun (2 pcs)', price: 120, foodType: 'VEG' },
      { name: 'Rasmalai',            price: 140, foodType: 'VEG' },
      { name: 'Kulfi Falooda',       price: 160, foodType: 'VEG' },
      { name: 'Phirni',              price: 110, foodType: 'VEG' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedMenu(
  restaurantId: string,
  menuData: { category: string; items: { name: string; price: number; foodType: string }[] }[],
) {
  let sortOrder = 0;
  for (const group of menuData) {
    let category = await prisma.category.findFirst({
      where: { restaurantId, name: group.category },
    });
    if (!category) {
      category = await prisma.category.create({
        data: { restaurantId, name: group.category, sortOrder: sortOrder++ },
      });
    }

    for (const item of group.items) {
      const existing = await prisma.menuItem.findFirst({
        where: { restaurantId, name: item.name },
      });
      if (!existing) {
        await prisma.menuItem.create({
          data: {
            restaurantId,
            categoryId: category.id,
            name:       item.name,
            price:      item.price,
            foodType:   item.foodType,
            isAvailable: true,
            isArchived:  false,
          },
        });
      }
    }
  }
}

async function seedTables(branchId: string, count: number, sections?: string[]) {
  let tableNum = 1;
  if (sections) {
    for (const section of sections) {
      const perSection = Math.ceil(count / sections.length);
      for (let i = 0; i < perSection && tableNum <= count; i++, tableNum++) {
        await prisma.table.upsert({
          where: { branchId_number: { branchId, number: String(tableNum) } },
          update: {},
          create: {
            branchId,
            number:   String(tableNum),
            section,
            capacity: tableNum <= 4 ? 2 : tableNum <= 8 ? 4 : 6,
          },
        });
      }
    }
  } else {
    for (let i = 1; i <= count; i++) {
      await prisma.table.upsert({
        where: { branchId_number: { branchId, number: String(i) } },
        update: {},
        create: {
          branchId,
          number:   String(i),
          capacity: i <= 4 ? 2 : 4,
        },
      });
    }
  }
}

async function createStaff(
  restaurantId: string,
  branchId: string,
  hashedPass: string,
  role: string,
  name: string,
  email: string,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: { restaurantId, branchId, name, email, password: hashedPass, role: role as any },
    });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const hash = await bcrypt.hash(PASS, 10);

  const proPlan = await prisma.plan.findFirst({ where: { name: 'PRO' } });
  const planId = proPlan?.id ?? null;

  // ── 1. COUNTER — QuickBite Counter ────────────────────────────────────────

  console.log('\n🏪 Seeding COUNTER restaurant: QuickBite Counter…');

  const counter = await prisma.restaurant.upsert({
    where: { id: 'demo-counter-restaurant' },
    update: { enabledModules: MODULE_DEFAULTS['COUNTER'], operatingMode: 'COUNTER' },
    create: {
      id:             'demo-counter-restaurant',
      name:           'QuickBite Counter',
      email:          'hello@quickbite.demo',
      phone:          '9000001111',
      city:           'Delhi',
      address:        '12 Connaught Place, New Delhi - 110001',
      gstin:          '07ABCDE1234F1Z5',
      operatingMode:  'COUNTER',
      enabledModules: MODULE_DEFAULTS['COUNTER'],
      planId,
    },
  });

  const counterBranch = await prisma.branch.upsert({
    where: { id: 'demo-counter-branch' },
    update: {},
    create: {
      id:           'demo-counter-branch',
      restaurantId: counter.id,
      name:         'Main Counter',
      address:      '12 Connaught Place, New Delhi',
    },
  });

  await prisma.onboardingProgress.upsert({
    where: { restaurantId: counter.id },
    update: {},
    create: { restaurantId: counter.id },
  });

  await createStaff(counter.id, counterBranch.id, hash, 'OWNER',   'Raj Sharma',      'owner@counter.demo');
  await createStaff(counter.id, counterBranch.id, hash, 'BILLER',  'Meena Verma',     'cashier@counter.demo');
  await createStaff(counter.id, counterBranch.id, hash, 'KITCHEN', 'Suresh Kumar',    'kitchen@counter.demo');
  await seedMenu(counter.id, COUNTER_MENU);

  console.log('  ✅ QuickBite Counter ready. 20 menu items, no tables (counter mode).');

  // ── 2. TABLE_SIMPLE — Udupi Café ──────────────────────────────────────────

  console.log('\n🍽️  Seeding TABLE_SIMPLE restaurant: Udupi Café…');

  const tableSim = await prisma.restaurant.upsert({
    where: { id: 'demo-tablesimple-restaurant' },
    update: { enabledModules: MODULE_DEFAULTS['TABLE_SIMPLE'], operatingMode: 'TABLE_SIMPLE' },
    create: {
      id:             'demo-tablesimple-restaurant',
      name:           'Udupi Café',
      email:          'hello@udupicafe.demo',
      phone:          '9000002222',
      city:           'Bangalore',
      address:        '88 Gandhi Bazaar, Basavanagudi, Bangalore - 560004',
      gstin:          '29FGHIJ5678K2M3',
      operatingMode:  'TABLE_SIMPLE',
      enabledModules: MODULE_DEFAULTS['TABLE_SIMPLE'],
      planId,
    },
  });

  const tableBranch = await prisma.branch.upsert({
    where: { id: 'demo-tablesimple-branch' },
    update: {},
    create: {
      id:           'demo-tablesimple-branch',
      restaurantId: tableSim.id,
      name:         'Main Branch',
      address:      '88 Gandhi Bazaar, Bangalore',
    },
  });

  await prisma.onboardingProgress.upsert({
    where: { restaurantId: tableSim.id },
    update: {},
    create: { restaurantId: tableSim.id },
  });

  await createStaff(tableSim.id, tableBranch.id, hash, 'OWNER',   'Priya Patel',    'owner@table.demo');
  await createStaff(tableSim.id, tableBranch.id, hash, 'CAPTAIN', 'Ramu Naidu',     'captain@table.demo');
  await createStaff(tableSim.id, tableBranch.id, hash, 'KITCHEN', 'Venkat Rao',     'kitchen@table.demo');
  await seedMenu(tableSim.id, TABLE_SIMPLE_MENU);
  await seedTables(tableBranch.id, 8);

  console.log('  ✅ Udupi Café ready. 21 menu items, 8 tables.');

  // ── 3. FULL_SERVICE — Grand Spice ─────────────────────────────────────────

  console.log('\n🍾 Seeding FULL_SERVICE restaurant: Grand Spice…');

  const full = await prisma.restaurant.upsert({
    where: { id: 'demo-fullservice-restaurant' },
    update: { enabledModules: MODULE_DEFAULTS['FULL_SERVICE'], operatingMode: 'FULL_SERVICE' },
    create: {
      id:             'demo-fullservice-restaurant',
      name:           'Grand Spice',
      email:          'hello@grandspice.demo',
      phone:          '9000003333',
      city:           'Mumbai',
      address:        '5 Marine Drive, Nariman Point, Mumbai - 400021',
      gstin:          '27KLMNO9012P3Q4',
      operatingMode:  'FULL_SERVICE',
      enabledModules: MODULE_DEFAULTS['FULL_SERVICE'],
      planId,
    },
  });

  const fullBranch = await prisma.branch.upsert({
    where: { id: 'demo-fullservice-branch' },
    update: {},
    create: {
      id:           'demo-fullservice-branch',
      restaurantId: full.id,
      name:         'Marine Drive Branch',
      address:      '5 Marine Drive, Mumbai',
    },
  });

  await prisma.onboardingProgress.upsert({
    where: { restaurantId: full.id },
    update: {},
    create: { restaurantId: full.id },
  });

  await createStaff(full.id, fullBranch.id, hash, 'OWNER',   'Arjun Mehta',    'owner@fullservice.demo');
  await createStaff(full.id, fullBranch.id, hash, 'MANAGER', 'Kavita Singh',   'manager@fullservice.demo');
  await createStaff(full.id, fullBranch.id, hash, 'CAPTAIN', 'Deepak Joshi',   'captain@fullservice.demo');
  await createStaff(full.id, fullBranch.id, hash, 'BILLER',  'Anita Sharma',   'cashier@fullservice.demo');
  await createStaff(full.id, fullBranch.id, hash, 'KITCHEN', 'Rajan Pillai',   'kitchen@fullservice.demo');
  await seedMenu(full.id, FULL_SERVICE_MENU);
  await seedTables(fullBranch.id, 12, ['Main Hall', 'Balcony', 'Private Room']);

  console.log('  ✅ Grand Spice ready. 30 menu items, 12 tables (3 sections).');

  // ── Print Summary ──────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(70));
  console.log('  DEMO LOGIN CREDENTIALS  (password for all: Demo@1234)');
  console.log('═'.repeat(70));

  console.log(`
🏪  COUNTER MODE — QuickBite Counter, Delhi
    Modules: KDS, Inventory, CRM, Online Orders, Devices, Accounting, Day Close
    No tables (counter billing only)

    Role      Email                       Password
    ────────  ──────────────────────────  ──────────
    Owner     owner@counter.demo          Demo@1234
    Cashier   cashier@counter.demo        Demo@1234
    Kitchen   kitchen@counter.demo        Demo@1234

🍽️   TABLE_SIMPLE MODE — Udupi Café, Bangalore
    Modules: Tables, KDS, Inventory, CRM, Online Orders, Devices, Accounting, Day Close
    8 tables (T1–T8), no reservations

    Role      Email                       Password
    ────────  ──────────────────────────  ──────────
    Owner     owner@table.demo            Demo@1234
    Captain   captain@table.demo          Demo@1234
    Kitchen   kitchen@table.demo          Demo@1234

🍾  FULL_SERVICE MODE — Grand Spice, Mumbai
    Modules: ALL (Tables, Reservations, KDS, Inventory, CRM, Online Orders,
             Multi-Outlet, Devices, Accounting, Day Close)
    12 tables (Main Hall, Balcony, Private Room)

    Role      Email                       Password
    ────────  ──────────────────────────  ──────────
    Owner     owner@fullservice.demo      Demo@1234
    Manager   manager@fullservice.demo    Demo@1234
    Captain   captain@fullservice.demo    Demo@1234
    Cashier   cashier@fullservice.demo    Demo@1234
    Kitchen   kitchen@fullservice.demo    Demo@1234

🔐  SUPER ADMIN
    Email     admin@restrosync.com
    Password  Admin@123
`);

  console.log('═'.repeat(70));
  console.log('  All demo data seeded successfully!');
  console.log('═'.repeat(70) + '\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
