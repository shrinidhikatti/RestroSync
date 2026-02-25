import { test, expect } from '@playwright/test';
import { loginSuperAdmin, logout, USERS } from './helpers';

test.describe('Super Admin', () => {

  test('Super admin: login redirects to admin area', async ({ page }) => {
    await loginSuperAdmin(page, USERS.superAdmin.email, USERS.superAdmin.password);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page).toHaveURL(/super-admin/);
    await logout(page);
  });

  test('Super admin: can view all restaurants', async ({ page }) => {
    await loginSuperAdmin(page, USERS.superAdmin.email, USERS.superAdmin.password);
    await page.goto('/super-admin/restaurants');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await logout(page);
  });
});
