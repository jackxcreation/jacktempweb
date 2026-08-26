import { test, expect } from '@playwright/test';

test.describe('🛒 Jack Essentials E2E User Journey', () => {
  test('user can browse product, add to cart, and reach checkout', async ({ page }) => {
    // 1. Visit Homepage
    await page.goto('https://thejackessentials.com');
    await expect(page).toHaveTitle(/Jack Essentials/);

    // 2. Navigate to Shop/Product
    await page.click('text=Shop Now');
    await page.click('.product-card:first-child');

    // 3. Add to Cart
    await page.click('button:has-text("Add to Cart")');
    await expect(page.locator('.cart-badge')).toHaveText('1');

    // 4. Proceed to Checkout
    await page.click('text=Cart');
    await page.click('button:has-text("Proceed to Checkout")');
    await expect(page).toHaveURL(/.*checkout/);
  });
});