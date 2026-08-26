# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: checkout.spec.js >> 🛒 Jack Essentials E2E User Journey >> user can browse product, add to cart, and reach checkout
- Location: tests\e2e\checkout.spec.js:4:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.product-card:first-child')

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - main [ref=f1e4]:
    - generic [ref=f1e5]:
      - generic [ref=f1e6]:
        - generic [ref=f1e7]:
          - link "JE Jack Essentials" [ref=f1e9] [cursor=pointer]:
            - /url: /
            - generic [ref=f1e10]: JE
            - generic [ref=f1e11]: Jack Essentials
          - generic [ref=f1e12]:
            - textbox "Search premium products, brands..." [ref=f1e13]
            - button [ref=f1e14]
          - generic [ref=f1e18]:
            - link "Sign In" [ref=f1e20] [cursor=pointer]:
              - /url: /login
            - link "Wishlist" [ref=f1e25] [cursor=pointer]:
              - /url: /profile
            - link "Cart" [ref=f1e29] [cursor=pointer]:
              - /url: /cart
        - generic [ref=f1e36]:
          - link "Shop All" [ref=f1e37] [cursor=pointer]:
            - /url: /shop
          - link "Electronics" [ref=f1e44] [cursor=pointer]:
            - /url: /shop
          - link "Fashion" [ref=f1e45] [cursor=pointer]:
            - /url: /shop
          - link "Home & Living" [ref=f1e46] [cursor=pointer]:
            - /url: /shop
          - link "🔥 Super Offers" [ref=f1e47] [cursor=pointer]:
            - /url: /shop
            - generic [ref=f1e48]: 🔥
            - generic [ref=f1e49]: Super Offers
      - main [ref=f1e50]:
        - generic [ref=f1e51]:
          - generic [ref=f1e52]:
            - generic [ref=f1e53]:
              - link "Home" [ref=f1e54] [cursor=pointer]:
                - /url: /
              - generic [ref=f1e55]: /
              - generic [ref=f1e56]: Collections
            - heading "Premium Shop" [level=1] [ref=f1e57]
            - paragraph [ref=f1e58]: Showing 3 curated products
          - textbox "Search products..." [ref=f1e64]
        - generic [ref=f1e65]:
          - generic [ref=f1e67]:
            - heading "Filters" [level=3] [ref=f1e69]
            - generic [ref=f1e72]:
              - heading "Categories" [level=4] [ref=f1e73]
              - generic [ref=f1e74]:
                - button "All" [ref=f1e75]
                - button "Fashion" [ref=f1e76]
                - button "Electronics" [ref=f1e77]
                - button "Home" [ref=f1e78]
                - button "Beauty" [ref=f1e79]
                - button "Travel" [ref=f1e80]
            - generic [ref=f1e81]:
              - heading "Sort By" [level=4] [ref=f1e82]
              - generic [ref=f1e83]:
                - generic [ref=f1e84] [cursor=pointer]: Most Popular
                - generic [ref=f1e88] [cursor=pointer]: Newest Arrivals
                - generic [ref=f1e91] [cursor=pointer]: "Price: Low to High"
                - generic [ref=f1e94] [cursor=pointer]: "Price: High to Low"
                - generic [ref=f1e97] [cursor=pointer]: Highest Rated
          - generic [ref=f1e101]:
            - link "81% OFF Jack Premium Portable Home First Aid Kit | Emergency Medical Storage Box with Handle | Complete Family Safety Kit for Home, Office, Travel Quick Add 4.5 (103) Health & Personal Care Jack Premium Portable Home First Aid Kit | Emergency Medical Storage Box with Handle | Complete Family Safety Kit for Home, Office, Travel ₹1299 ₹249" [ref=f1e102] [cursor=pointer]:
              - /url: /product/6a7ca7dec50dec9d1aa089cf
              - generic [ref=f1e103]:
                - generic [ref=f1e104]: 81% OFF
                - button [ref=f1e106]
                - generic [ref=f1e109]:
                  - img "Jack Premium Portable Home First Aid Kit | Emergency Medical Storage Box with Handle | Complete Family Safety Kit for Home, Office, Travel"
                  - button "Quick Add" [ref=f1e111]
                - generic [ref=f1e116]:
                  - generic [ref=f1e117]:
                    - generic [ref=f1e120]: "4.5"
                    - generic [ref=f1e121]: (103)
                  - paragraph [ref=f1e122]: Health & Personal Care
                  - heading "Jack Premium Portable Home First Aid Kit | Emergency Medical Storage Box with Handle | Complete Family Safety Kit for Home, Office, Travel" [level=3] [ref=f1e123]
                  - generic [ref=f1e125]:
                    - generic [ref=f1e126]: ₹1299
                    - generic [ref=f1e127]: ₹249
            - link "31% OFF Jack Premium Heavy Duty Hacksaw for Metal & Wood Cutting | Adjustable Hand Saw Tool with Ergonomic Grip Quick Add 4.5 (66) Tools Jack Premium Heavy Duty Hacksaw for Metal & Wood Cutting | Adjustable Hand Saw Tool with Ergonomic Grip ₹799 ₹549" [ref=f1e128] [cursor=pointer]:
              - /url: /product/6a3b9fcdb47cacb59f871c80
              - generic [ref=f1e129]:
                - generic [ref=f1e130]: 31% OFF
                - button [ref=f1e132]
                - generic [ref=f1e135]:
                  - img "Jack Premium Heavy Duty Hacksaw for Metal & Wood Cutting | Adjustable Hand Saw Tool with Ergonomic Grip"
                  - button "Quick Add" [ref=f1e137]
                - generic [ref=f1e142]:
                  - generic [ref=f1e143]:
                    - generic [ref=f1e146]: "4.5"
                    - generic [ref=f1e147]: (66)
                  - paragraph [ref=f1e148]: Tools
                  - heading "Jack Premium Heavy Duty Hacksaw for Metal & Wood Cutting | Adjustable Hand Saw Tool with Ergonomic Grip" [level=3] [ref=f1e149]
                  - generic [ref=f1e151]:
                    - generic [ref=f1e152]: ₹799
                    - generic [ref=f1e153]: ₹549
            - link "100% OFF For Devloper Testing Only Quick Add 4.5 (90) Home For Devloper Testing Only ₹999 ₹1" [ref=f1e154] [cursor=pointer]:
              - /url: /product/6a20189768d247f22729d651
              - generic [ref=f1e155]:
                - generic [ref=f1e156]: 100% OFF
                - button [ref=f1e158]
                - generic [ref=f1e161]:
                  - img "For Devloper Testing Only"
                  - button "Quick Add" [ref=f1e163]
                - generic [ref=f1e168]:
                  - generic [ref=f1e169]:
                    - generic [ref=f1e172]: "4.5"
                    - generic [ref=f1e173]: (90)
                  - paragraph [ref=f1e174]: Home
                  - heading "For Devloper Testing Only" [level=3] [ref=f1e175]
                  - generic [ref=f1e177]:
                    - generic [ref=f1e178]: ₹999
                    - generic [ref=f1e179]: ₹1
  - contentinfo [ref=f1e180]:
    - generic [ref=f1e181]:
      - generic [ref=f1e182]:
        - generic [ref=f1e183]:
          - link "JEJack Essentials" [ref=f1e184] [cursor=pointer]:
            - /url: /
            - generic [ref=f1e185]: JE
            - text: Jack Essentials
          - paragraph [ref=f1e186]: Upgrade your lifestyle with our premium collection of electronics, fashion, and daily essentials. Designed for the modern Indian.
          - generic [ref=f1e187]:
            - paragraph [ref=f1e188]: Subscribe to Insider Emails
            - generic [ref=f1e189]:
              - textbox "Enter your email address" [ref=f1e190]
              - button [ref=f1e191]
        - generic [ref=f1e194]:
          - heading "Quick Links" [level=3] [ref=f1e195]
          - list [ref=f1e196]:
            - listitem [ref=f1e197]:
              - link "About Us" [ref=f1e198] [cursor=pointer]:
                - /url: /about
            - listitem [ref=f1e199]:
              - link "Electronics" [ref=f1e200] [cursor=pointer]:
                - /url: /shop/electronics
            - listitem [ref=f1e201]:
              - link "Men's Fashion" [ref=f1e202] [cursor=pointer]:
                - /url: /shop/fashion
            - listitem [ref=f1e203]:
              - link "Home & Living" [ref=f1e204] [cursor=pointer]:
                - /url: /shop/home
            - listitem [ref=f1e205]:
              - link "Super Offers 🔥" [ref=f1e206] [cursor=pointer]:
                - /url: /shop
        - generic [ref=f1e207]:
          - heading "Support & Legal" [level=3] [ref=f1e208]
          - list [ref=f1e209]:
            - listitem [ref=f1e210]:
              - link "Track Your Order" [ref=f1e211] [cursor=pointer]:
                - /url: /track-order
            - listitem [ref=f1e212]:
              - link "Returns & Refunds" [ref=f1e213] [cursor=pointer]:
                - /url: /returns
            - listitem [ref=f1e214]:
              - link "Help Center / FAQ" [ref=f1e215] [cursor=pointer]:
                - /url: /help-center
            - listitem [ref=f1e216]:
              - link "Contact Us" [ref=f1e217] [cursor=pointer]:
                - /url: /contact
            - listitem [ref=f1e218]:
              - link "Terms of Service" [ref=f1e219] [cursor=pointer]:
                - /url: /terms
            - listitem [ref=f1e220]:
              - link "Privacy Policy" [ref=f1e221] [cursor=pointer]:
                - /url: /privacy-policy
        - generic [ref=f1e222]:
          - heading "Reach Us" [level=3] [ref=f1e223]
          - list [ref=f1e224]:
            - listitem [ref=f1e225]:
              - generic [ref=f1e229]: Jack Essentials Headquarters,Cuttack, Odisha, 754132India
            - listitem [ref=f1e230] [cursor=pointer]: support@jackessentials.in
            - listitem [ref=f1e234] [cursor=pointer]: +91 911-436-9743
          - generic [ref=f1e237]:
            - link [ref=f1e238] [cursor=pointer]:
              - /url: https://www.instagram.com/jack_official_tm
            - link [ref=f1e242] [cursor=pointer]:
              - /url: "#"
            - link [ref=f1e245] [cursor=pointer]:
              - /url: https://www.facebook.com/61577457173250
            - link [ref=f1e248] [cursor=pointer]:
              - /url: "#"
      - generic [ref=f1e252]:
        - generic [ref=f1e259]:
          - paragraph [ref=f1e260]: Free Delivery
          - paragraph [ref=f1e261]: On orders above ₹499
        - generic [ref=f1e267]:
          - paragraph [ref=f1e268]: 7 Days Return
          - paragraph [ref=f1e269]: No questions asked
        - generic [ref=f1e273]:
          - paragraph [ref=f1e274]: 100% Secure
          - paragraph [ref=f1e275]: Encrypted payments
      - generic [ref=f1e276]:
        - paragraph [ref=f1e278]: © 2026 Jack Essentials Inc. All Rights Reserved.
        - generic [ref=f1e279]:
          - generic [ref=f1e280]: UPI
          - generic [ref=f1e281]: VISA
          - generic [ref=f1e282]: MasterCard
          - generic [ref=f1e283]: RuPay
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('🛒 Jack Essentials E2E User Journey', () => {
  4  |   test('user can browse product, add to cart, and reach checkout', async ({ page }) => {
  5  |     // 1. Visit Homepage
  6  |     await page.goto('https://thejackessentials.com');
  7  |     await expect(page).toHaveTitle(/Jack Essentials/);
  8  | 
  9  |     // 2. Navigate to Shop/Product
  10 |     await page.click('text=Shop Now');
> 11 |     await page.click('.product-card:first-child');
     |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  12 | 
  13 |     // 3. Add to Cart
  14 |     await page.click('button:has-text("Add to Cart")');
  15 |     await expect(page.locator('.cart-badge')).toHaveText('1');
  16 | 
  17 |     // 4. Proceed to Checkout
  18 |     await page.click('text=Cart');
  19 |     await page.click('button:has-text("Proceed to Checkout")');
  20 |     await expect(page).toHaveURL(/.*checkout/);
  21 |   });
  22 | });
```