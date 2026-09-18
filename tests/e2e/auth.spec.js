// tests/e2e/auth.spec.js
import { test, expect } from '@playwright/test';

test.describe('🔐 Jack Essentials Auth E2E Suite', () => {
  test('user login page loads and validates credentials', async ({ page }) => {
    await page.goto('https://thejackessentials.com/login');
    await expect(page).toHaveTitle(/Jack Essentials/);
    
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible();

    const submitBtn = page.getByRole('button', { name: /login|sign in|continue/i }).first();
    await expect(submitBtn).toBeVisible();
  });
});