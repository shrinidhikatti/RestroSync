import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Plans
  const freePlan = await prisma.plan.upsert({
    where: { id: 'plan-free' },
    update: {},
    create: {
      id: 'plan-free',
      name: 'FREE',
      maxBranches: 1,
      maxDevices: 1,
      maxStaff: 3,
      maxMenuItems: 50,
      features: { inventory: false, crm: false, multiOutlet: false },
      priceMonthly: 0,
    },
  });

  const basicPlan = await prisma.plan.upsert({
    where: { id: 'plan-basic' },
    update: {},
    create: {
      id: 'plan-basic',
      name: 'BASIC',
      maxBranches: 1,
      maxDevices: 5,
      maxStaff: 10,
      maxMenuItems: 200,
      features: { inventory: true, crm: true, multiOutlet: false },
      priceMonthly: 999,
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { id: 'plan-pro' },
    update: {},
    create: {
      id: 'plan-pro',
      name: 'PRO',
      maxBranches: 3,
      maxDevices: 20,
      maxStaff: 50,
      maxMenuItems: 1000,
      features: { inventory: true, crm: true, multiOutlet: true },
      priceMonthly: 2999,
    },
  });

  const enterprisePlan = await prisma.plan.upsert({
    where: { id: 'plan-enterprise' },
    update: {},
    create: {
      id: 'plan-enterprise',
      name: 'ENTERPRISE',
      maxBranches: -1,
      maxDevices: -1,
      maxStaff: -1,
      maxMenuItems: -1,
      features: { inventory: true, crm: true, multiOutlet: true },
      priceMonthly: 9999,
    },
  });

  console.log('Plans created.');

  // 2. Create Super Admin
  const superAdminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@restrosync.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@restrosync.com',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
      restaurantId: null,
      branchId: null,
    },
  });
  console.log('Super Admin created: admin@restrosync.com / admin123');

  // 3. Create Menu Templates
  const templates = [
    {
      id: 'tmpl-south-indian',
      name: 'South Indian',
      cuisine: 'south-indian',
      data: {
        categories: [
          {
            name: 'Dosa',
            items: [
              { name: 'Plain Dosa', shortName: 'PD', foodType: 'VEG' },
              { name: 'Masala Dosa', shortName: 'MD', foodType: 'VEG' },
              { name: 'Mysore Masala Dosa', shortName: 'MMD', foodType: 'VEG' },
              { name: 'Rava Dosa', shortName: 'RD', foodType: 'VEG' },
              { name: 'Onion Dosa', shortName: 'OD', foodType: 'VEG' },
              { name: 'Set Dosa', shortName: 'SD', foodType: 'VEG' },
            ],
          },
          {
            name: 'Idli & Vada',
            items: [
              { name: 'Idli (2 pcs)', shortName: 'IDL', foodType: 'VEG' },
              { name: 'Medu Vada (2 pcs)', shortName: 'MV', foodType: 'VEG' },
              { name: 'Idli Vada Combo', shortName: 'IVC', foodType: 'VEG' },
              { name: 'Mini Idli', shortName: 'MI', foodType: 'VEG' },
            ],
          },
          {
            name: 'Rice & Meals',
            items: [
              { name: 'Sambar Rice', shortName: 'SR', foodType: 'VEG' },
              { name: 'Curd Rice', shortName: 'CR', foodType: 'VEG' },
              { name: 'Lemon Rice', shortName: 'LR', foodType: 'VEG' },
              { name: 'Bisi Bele Bath', shortName: 'BBB', foodType: 'VEG' },
              { name: 'Meals (Unlimited)', shortName: 'MEAL', foodType: 'VEG' },
            ],
          },
          {
            name: 'Beverages',
            items: [
              { name: 'Filter Coffee', shortName: 'FC', foodType: 'VEG' },
              { name: 'Tea', shortName: 'TEA', foodType: 'VEG' },
              { name: 'Badam Milk', shortName: 'BM', foodType: 'VEG' },
              { name: 'Buttermilk', shortName: 'BMK', foodType: 'VEG' },
            ],
          },
        ],
      },
    },
    {
      id: 'tmpl-north-indian',
      name: 'North Indian',
      cuisine: 'north-indian',
      data: {
        categories: [
          {
            name: 'Starters',
            items: [
              { name: 'Paneer Tikka', shortName: 'PT', foodType: 'VEG' },
              { name: 'Chicken Tikka', shortName: 'CT', foodType: 'NON_VEG' },
              { name: 'Tandoori Chicken', shortName: 'TC', foodType: 'NON_VEG' },
              { name: 'Hara Bhara Kebab', shortName: 'HBK', foodType: 'VEG' },
              { name: 'Fish Fry', shortName: 'FF', foodType: 'NON_VEG' },
            ],
          },
          {
            name: 'Curries',
            items: [
              { name: 'Paneer Butter Masala', shortName: 'PBM', foodType: 'VEG' },
              { name: 'Dal Makhani', shortName: 'DM', foodType: 'VEG' },
              { name: 'Butter Chicken', shortName: 'BC', foodType: 'NON_VEG' },
              { name: 'Palak Paneer', shortName: 'PP', foodType: 'VEG' },
              { name: 'Chicken Curry', shortName: 'CC', foodType: 'NON_VEG' },
              { name: 'Chole', shortName: 'CHL', foodType: 'VEG' },
            ],
          },
          {
            name: 'Breads',
            items: [
              { name: 'Butter Naan', shortName: 'BN', foodType: 'VEG' },
              { name: 'Garlic Naan', shortName: 'GN', foodType: 'VEG' },
              { name: 'Tandoori Roti', shortName: 'TR', foodType: 'VEG' },
              { name: 'Laccha Paratha', shortName: 'LP', foodType: 'VEG' },
            ],
          },
          {
            name: 'Rice',
            items: [
              { name: 'Jeera Rice', shortName: 'JR', foodType: 'VEG' },
              { name: 'Veg Biryani', shortName: 'VB', foodType: 'VEG' },
              { name: 'Chicken Biryani', shortName: 'CB', foodType: 'NON_VEG' },
              { name: 'Mutton Biryani', shortName: 'MB', foodType: 'NON_VEG' },
            ],
          },
          {
            name: 'Desserts',
            items: [
              { name: 'Gulab Jamun', shortName: 'GJ', foodType: 'VEG' },
              { name: 'Rasmalai', shortName: 'RM', foodType: 'VEG' },
              { name: 'Kulfi', shortName: 'KF', foodType: 'VEG' },
            ],
          },
        ],
      },
    },
    {
      id: 'tmpl-chinese',
      name: 'Chinese / Indo-Chinese',
      cuisine: 'chinese',
      data: {
        categories: [
          {
            name: 'Soups',
            items: [
              { name: 'Manchow Soup', shortName: 'MS', foodType: 'VEG' },
              { name: 'Sweet Corn Soup', shortName: 'SCS', foodType: 'VEG' },
              { name: 'Hot & Sour Soup', shortName: 'HSS', foodType: 'VEG' },
            ],
          },
          {
            name: 'Starters',
            items: [
              { name: 'Spring Roll', shortName: 'SPR', foodType: 'VEG' },
              { name: 'Paneer Chilli', shortName: 'PC', foodType: 'VEG' },
              { name: 'Chicken 65', shortName: 'C65', foodType: 'NON_VEG' },
              { name: 'Gobi Manchurian', shortName: 'GM', foodType: 'VEG' },
              { name: 'Chicken Lollipop', shortName: 'CL', foodType: 'NON_VEG' },
            ],
          },
          {
            name: 'Noodles',
            items: [
              { name: 'Hakka Noodles', shortName: 'HN', foodType: 'VEG' },
              { name: 'Schezwan Noodles', shortName: 'SN', foodType: 'VEG' },
              { name: 'Chicken Noodles', shortName: 'CN', foodType: 'NON_VEG' },
            ],
          },
          {
            name: 'Rice',
            items: [
              { name: 'Fried Rice', shortName: 'FR', foodType: 'VEG' },
              { name: 'Schezwan Fried Rice', shortName: 'SFR', foodType: 'VEG' },
              { name: 'Chicken Fried Rice', shortName: 'CFR', foodType: 'NON_VEG' },
            ],
          },
        ],
      },
    },
    {
      id: 'tmpl-cafe',
      name: 'Cafe / Bakery',
      cuisine: 'cafe',
      data: {
        categories: [
          {
            name: 'Coffee',
            items: [
              { name: 'Cappuccino', shortName: 'CAP', foodType: 'VEG' },
              { name: 'Latte', shortName: 'LAT', foodType: 'VEG' },
              { name: 'Americano', shortName: 'AMR', foodType: 'VEG' },
              { name: 'Cold Coffee', shortName: 'CCF', foodType: 'VEG' },
              { name: 'Espresso', shortName: 'ESP', foodType: 'VEG' },
            ],
          },
          {
            name: 'Tea',
            items: [
              { name: 'Masala Chai', shortName: 'MCH', foodType: 'VEG' },
              { name: 'Green Tea', shortName: 'GT', foodType: 'VEG' },
              { name: 'Lemon Tea', shortName: 'LT', foodType: 'VEG' },
            ],
          },
          {
            name: 'Snacks',
            items: [
              { name: 'Veg Sandwich', shortName: 'VS', foodType: 'VEG' },
              { name: 'Grilled Sandwich', shortName: 'GS', foodType: 'VEG' },
              { name: 'Samosa (2 pcs)', shortName: 'SAM', foodType: 'VEG' },
              { name: 'Puff', shortName: 'PF', foodType: 'VEG' },
            ],
          },
          {
            name: 'Desserts',
            items: [
              { name: 'Chocolate Brownie', shortName: 'BRN', foodType: 'VEG' },
              { name: 'Muffin', shortName: 'MUF', foodType: 'VEG' },
              { name: 'Pastry', shortName: 'PST', foodType: 'VEG' },
              { name: 'Cheesecake', shortName: 'CHC', foodType: 'VEG' },
            ],
          },
        ],
      },
    },
    {
      id: 'tmpl-fast-food',
      name: 'Fast Food / QSR',
      cuisine: 'fast-food',
      data: {
        categories: [
          {
            name: 'Burgers',
            items: [
              { name: 'Veg Burger', shortName: 'VB', foodType: 'VEG' },
              { name: 'Chicken Burger', shortName: 'CHB', foodType: 'NON_VEG' },
              { name: 'Paneer Burger', shortName: 'PB', foodType: 'VEG' },
            ],
          },
          {
            name: 'Wraps & Rolls',
            items: [
              { name: 'Paneer Roll', shortName: 'PR', foodType: 'VEG' },
              { name: 'Chicken Roll', shortName: 'CRO', foodType: 'NON_VEG' },
              { name: 'Egg Roll', shortName: 'ER', foodType: 'EGG' },
            ],
          },
          {
            name: 'Sides',
            items: [
              { name: 'French Fries', shortName: 'FRF', foodType: 'VEG' },
              { name: 'Onion Rings', shortName: 'OR', foodType: 'VEG' },
              { name: 'Coleslaw', shortName: 'CLS', foodType: 'VEG' },
            ],
          },
          {
            name: 'Beverages',
            items: [
              { name: 'Coke', shortName: 'CK', foodType: 'VEG' },
              { name: 'Sprite', shortName: 'SPR', foodType: 'VEG' },
              { name: 'Fresh Lime Soda', shortName: 'FLS', foodType: 'VEG' },
              { name: 'Milkshake', shortName: 'MLS', foodType: 'VEG' },
            ],
          },
        ],
      },
    },
    {
      id: 'tmpl-multi-cuisine',
      name: 'Multi-Cuisine',
      cuisine: 'multi-cuisine',
      data: {
        categories: [
          {
            name: 'Starters',
            items: [
              { name: 'Paneer Tikka', shortName: 'PT', foodType: 'VEG' },
              { name: 'Chicken Tikka', shortName: 'CT', foodType: 'NON_VEG' },
              { name: 'Spring Roll', shortName: 'SPR', foodType: 'VEG' },
              { name: 'French Fries', shortName: 'FRF', foodType: 'VEG' },
            ],
          },
          {
            name: 'Main Course',
            items: [
              { name: 'Paneer Butter Masala', shortName: 'PBM', foodType: 'VEG' },
              { name: 'Butter Chicken', shortName: 'BC', foodType: 'NON_VEG' },
              { name: 'Hakka Noodles', shortName: 'HN', foodType: 'VEG' },
              { name: 'Fried Rice', shortName: 'FR', foodType: 'VEG' },
              { name: 'Dal Makhani', shortName: 'DM', foodType: 'VEG' },
            ],
          },
          {
            name: 'Breads & Rice',
            items: [
              { name: 'Butter Naan', shortName: 'BN', foodType: 'VEG' },
              { name: 'Jeera Rice', shortName: 'JR', foodType: 'VEG' },
              { name: 'Chicken Biryani', shortName: 'CB', foodType: 'NON_VEG' },
            ],
          },
          {
            name: 'Beverages',
            items: [
              { name: 'Fresh Lime Soda', shortName: 'FLS', foodType: 'VEG' },
              { name: 'Masala Chai', shortName: 'MCH', foodType: 'VEG' },
              { name: 'Cold Coffee', shortName: 'CCF', foodType: 'VEG' },
            ],
          },
        ],
      },
    },
  ];

  for (const tmpl of templates) {
    await prisma.menuTemplate.upsert({
      where: { id: tmpl.id },
      update: { data: tmpl.data },
      create: tmpl,
    });
  }
  console.log('Menu templates created (6 cuisines).');

  // 4. Create global permissions (null restaurantId = system-wide definitions)
  const systemPermissions = [
    { code: 'menu:view', name: 'View Menu' },
    { code: 'menu:edit', name: 'Edit Menu' },
    { code: 'menu:toggle_availability', name: 'Toggle Item Availability' },
    { code: 'order:create', name: 'Create Order' },
    { code: 'order:cancel', name: 'Cancel Order' },
    { code: 'order:apply_discount', name: 'Apply Discount' },
    { code: 'order:price_override', name: 'Override Price' },
    { code: 'order:set_priority', name: 'Set Order Priority' },
    { code: 'order:override_availability', name: 'Override Item Availability' },
    { code: 'order:complimentary', name: 'Create Complimentary Order' },
    { code: 'bill:generate', name: 'Generate Bill' },
    { code: 'bill:void', name: 'Void Bill' },
    { code: 'bill:reprint', name: 'Reprint Bill' },
    { code: 'bill:refund', name: 'Issue Refund' },
    { code: 'kot:view', name: 'View KOT' },
    { code: 'kot:mark_ready', name: 'Mark KOT Ready' },
    { code: 'inventory:view', name: 'View Inventory' },
    { code: 'inventory:edit', name: 'Edit Inventory' },
    { code: 'reports:view', name: 'View Reports' },
    { code: 'settings:edit', name: 'Edit Settings' },
    { code: 'staff:manage', name: 'Manage Staff' },
    { code: 'crm:manage_credit', name: 'Manage Credit Accounts' },
    { code: 'drawer:manual_open', name: 'Open Cash Drawer Manually' },
  ];

  // Delete existing system permissions and re-create
  await prisma.permission.deleteMany({ where: { restaurantId: null } });
  await prisma.permission.createMany({
    data: systemPermissions.map((p) => ({ code: p.code, name: p.name, restaurantId: null })),
    skipDuplicates: true,
  });

  console.log('System permissions seeded.');
  console.log('\nSeed complete!');
  console.log('Super Admin: admin@restrosync.com / admin123');
  console.log('Plans: FREE, BASIC, PRO, ENTERPRISE');
  console.log('Templates: South Indian, North Indian, Chinese, Cafe, Fast Food, Multi-Cuisine');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
