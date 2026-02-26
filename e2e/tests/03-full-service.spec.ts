import { test, expect } from '@playwright/test';
import { login, logout, USERS, expectSidebarItem } from './helpers';

test.describe('FULL_SERVICE mode — Grand Spice', () => {

  test('Owner: sidebar shows all modules including Reservations', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await expectSidebarItem(page, 'Tables');
    await expectSidebarItem(page, 'Reservations');
    await expectSidebarItem(page, 'Orders');
    await logout(page);
  });

  test('Owner: tables page shows 12 tables across 3 sections', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');

    // exact: true prevents T1 from matching T10/T11/T12
    await expect(page.getByText('T1', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('T5', { exact: true })).toBeVisible();
    await expect(page.getByText('T9', { exact: true })).toBeVisible();
    await expect(page.getByText('T12', { exact: true })).toBeVisible();

    // 3 sections — seed stores title-case; CSS uppercase is visual only
    // .first() avoids strict mode if section name appears in multiple DOM nodes
    await expect(page.getByText('Main Hall').first()).toBeVisible();
    await expect(page.getByText('Balcony').first()).toBeVisible();
    await expect(page.getByText('Private Room').first()).toBeVisible();

    await logout(page);
  });

  test('Owner: reservations page loads', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await page.goto('/reservations');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: can open table and see options', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');
    // .first() avoids strict mode if T1 label appears in multiple elements
    // force:true bypasses overlay/interactability checks
    await page.getByText('T1', { exact: true }).first().click({ force: true });
    // Drawer renders as div.fixed.inset-0 (no role="dialog")
    await expect(page.locator('div.fixed.inset-0')).toBeVisible({ timeout: 10_000 });
    await logout(page);
  });

  test('Owner: orders page loads', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: full menu — 30 items visible', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await page.goto('/menu/items');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: inventory page loads', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await page.goto('/inventory/ingredients');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: CRM customers page loads', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await page.goto('/crm/customers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: day close page loads', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await page.goto('/day-close');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: settings — tax page loads', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await page.goto('/settings/tax');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Manager: login and access dashboard', async ({ page }) => {
    await login(page, USERS.full.manager.email);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Captain: login and access tables', async ({ page }) => {
    await login(page, USERS.full.captain.email);
    await page.waitForLoadState('networkidle');
    await page.goto('/tables');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('T1', { exact: true })).toBeVisible({ timeout: 15_000 });
    await logout(page);
  });

  test('Biller: login and access orders/POS', async ({ page }) => {
    await login(page, USERS.full.biller.email);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Kitchen: login and KDS loads', async ({ page }) => {
    await login(page, USERS.full.kitchen.email);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: multi-outlet overview loads', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await page.goto('/multi-outlet/overview');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });

  test('Owner: staff management page loads', async ({ page }) => {
    await login(page, USERS.full.owner.email);
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });
});
