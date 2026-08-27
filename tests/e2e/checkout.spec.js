import { test, expect } from '@playwright/test';

test.describe('🛒 Jack Essentials E2E User Journey', () => {
  test('user can browse product, add to cart, and reach checkout', async ({ page }) => {
    // 1. Visit Homepage
    await page.goto('https://thejackessentials.com');
    await expect(page).toHaveTitle(/Jack Essentials/);

    // 2. Navigate to Shop/Product
    // 🔥 FIX: Using robust regex match for Shop links
    await page.getByRole('link', { name: /shop/i }).first().click();
    
    // 🔥 FIX: Replaced stale '.product-card:first-child' with reliable product URL locator
    await page.locator('a[href*="/product/"]').first().click();

    // 3. Add to Cart
    // 🔥 FIX: Updated from "Add to Cart" to current UI "ADD TO BAG"
    await page.getByRole('button', { name: /add to bag/i }).first().click();
    
    // 🔥 FIX: Replaced non-existent '.cart-badge'. Now verifying the cart link contains '1'
    await expect(page.locator('a[href="/cart"]').first()).toContainText('1', { timeout: 10000 });

    // 4. Proceed to Checkout
    // 🔥 FIX: Safely clicking the Cart icon/link
    await page.locator('a[href="/cart"]').first().click();
    
    // 🔥 FIX: Updated to match "PROCEED TO SECURE CHECKOUT" button
    await page.getByRole('button', { name: /proceed to secure checkout/i }).click();
    
    await expect(page).toHaveURL(/.*checkout/);
  });
});