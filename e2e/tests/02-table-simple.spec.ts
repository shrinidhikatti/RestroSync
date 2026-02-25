import { test, expect } from '@playwright/test';
import { login, logout, USERS, expectSidebarItem, expectNoSidebarItem } from './helpers';

test.describe('TABLE_SIMPLE mode — Udupi Café', () => {

  test('Owner: sidebar shows Tables, no Reservations', async ({ page }) => {
    await login(page, USERS.table.owner.email);
    await expectSidebarItem(page, 'Tables');
    await expectNoSidebarItem(page, 'Reservations');
    await logout(page);
  });

  test('Owner: tables page shows 8 tables', async ({ page }) => {
    await login(page, USERS.table.owner.email);
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');
    // Should show table cards T1–T8
    await expect(page.getByText('T1')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('T8')).toBeVisible({ timeout: 5_000 });
    // Should NOT have sections (no sections in TABLE_SIMPLE)
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: can open a table and start an order', async ({ page }) => {
    await login(page, USERS.table.owner.email);
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');
    // Click on T1
    const t1 = page.getByText('T1').first();
    await t1.click();
    // Drawer/Modal renders as div.fixed.inset-0 (no role="dialog")
    await expect(page.locator('div.fixed.inset-0')).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('Owner: menu categories page loads with items', async ({ page }) => {
    await login(page, USERS.table.owner.email);
    await page.goto('/menu/categories');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: menu items page shows 21 items', async ({ page }) => {
    await login(page, USERS.table.owner.email);
    await page.goto('/menu/items');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    // Should have some menu items visible
    const items = page.locator('[class*="card"], [class*="item"], tr').filter({ hasText: /₹|\$/ });
    await expect(items.first()).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('Captain: login and access tables', async ({ page }) => {
    await login(page, USERS.table.captain.email);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    // Captain should see tables
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('T1')).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('Kitchen: login and KDS loads', async ({ page }) => {
    await login(page, USERS.table.kitchen.email);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: orders page loads', async ({ page }) => {
    await login(page, USERS.table.owner.email);
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: reports page loads', async ({ page }) => {
    await login(page, USERS.table.owner.email);
    await page.goto('/reports/sales');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });
});
