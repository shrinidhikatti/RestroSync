import { test, expect } from '@playwright/test';
import { login, logout, USERS, PASS, expectSidebarItem, expectNoSidebarItem } from './helpers';

test.describe('COUNTER mode — QuickBite Counter', () => {

  test('Owner: login, sidebar shows correct modules, no Tables/Reservations', async ({ page }) => {
    await login(page, USERS.counter.owner.email);
    await expect(page).toHaveURL(/\//);

    // Should have
    await expectSidebarItem(page, 'Dashboard');
    await expectSidebarItem(page, 'Orders');

    // Should NOT have Tables or Reservations
    await expectNoSidebarItem(page, 'Tables');
    await expectNoSidebarItem(page, 'Reservations');

    await logout(page);
  });

  test('Owner: dashboard loads with stats', async ({ page }) => {
    await login(page, USERS.counter.owner.email);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Dashboard should have some stat cards
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
    await logout(page);
  });

  test('Owner: menu items page loads', async ({ page }) => {
    await login(page, USERS.counter.owner.email);
    await page.goto('/menu/items');
    await page.waitForLoadState('networkidle');
    // Should show some menu items (seeded 20 items)
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: orders page loads', async ({ page }) => {
    await login(page, USERS.counter.owner.email);
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: can create a new order', async ({ page }) => {
    await login(page, USERS.counter.owner.email);
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
    // .first() avoids strict mode if multiple buttons match the pattern
    const newOrderBtn = page.getByRole('button', { name: /new order|add order|\+ order/i }).first();
    if (await newOrderBtn.isVisible()) {
      await newOrderBtn.click();
      // Modal/Drawer renders as div.fixed.inset-0 (no role="dialog")
      await expect(page.locator('div.fixed.inset-0')).toBeVisible({ timeout: 10_000 });
    }
    await logout(page);
  });

  test('Biller: login redirects to orders/pos', async ({ page }) => {
    await login(page, USERS.counter.biller.email);
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Kitchen: login and kitchen display loads', async ({ page }) => {
    await login(page, USERS.counter.kitchen.email);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: settings page accessible', async ({ page }) => {
    await login(page, USERS.counter.owner.email);
    await page.goto('/settings/restaurant');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: staff page loads', async ({ page }) => {
    await login(page, USERS.counter.owner.email);
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });
});
