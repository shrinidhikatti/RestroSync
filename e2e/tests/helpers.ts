import { Page, expect } from '@playwright/test';

export const BASE = 'https://restrosync-frontend.onrender.com';
export const PASS = 'Demo@1234';

export const USERS = {
  counter: {
    owner:   { email: 'owner@counter.demo',   role: 'OWNER'   },
    biller:  { email: 'cashier@counter.demo',  role: 'BILLER'  },
    kitchen: { email: 'kitchen@counter.demo',  role: 'KITCHEN' },
  },
  table: {
    owner:   { email: 'owner@table.demo',   role: 'OWNER'   },
    captain: { email: 'captain@table.demo', role: 'CAPTAIN' },
    kitchen: { email: 'kitchen@table.demo', role: 'KITCHEN' },
  },
  full: {
    owner:   { email: 'owner@fullservice.demo',   role: 'OWNER'   },
    manager: { email: 'manager@fullservice.demo',  role: 'MANAGER' },
    captain: { email: 'captain@fullservice.demo',  role: 'CAPTAIN' },
    biller:  { email: 'cashier@fullservice.demo',  role: 'BILLER'  },
    kitchen: { email: 'kitchen@fullservice.demo',  role: 'KITCHEN' },
  },
  superAdmin: { email: 'admin@restrosync.com', password: 'Admin@123' },
};

export async function login(page: Page, email: string, password = PASS) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for redirect away from login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45_000 });
  // Wait for initial API calls (activeModules, restaurant info) to complete
  await page.waitForLoadState('networkidle');
}

export async function loginSuperAdmin(page: Page, email: string, password: string) {
  await page.goto('/super-admin/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname.includes('/super-admin'), { timeout: 20_000 });
}

export async function logout(page: Page) {
  // Click the logout button in sidebar
  const logoutBtn = page.getByTitle('Logout');
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
  } else {
    await page.goto('/login');
  }
  await page.waitForURL('**/login', { timeout: 10_000 });
}

export async function expectSidebarItem(page: Page, label: string) {
  // exact: true prevents 'Orders' from matching 'Online Orders'
  // .first() avoids strict mode when the link appears in both desktop + mobile nav
  await expect(page.getByRole('link', { name: label, exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

export async function expectNoSidebarItem(page: Page, label: string) {
  // exact: true prevents 'Tables' from matching 'Multi-Outlet' etc.
  // .first() avoids strict mode; if first is not visible, item is considered absent
  await expect(page.getByRole('link', { name: label, exact: true }).first()).not.toBeVisible({ timeout: 10_000 });
}
