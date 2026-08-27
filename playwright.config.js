const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e', // 🔥 Sirf e2e folder ke andar ke tests run honge
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    headless: true,
    // 🔥 Dynamic baseURL configuration to prevent hitting production during testing
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],

  // 🔥 Automatically build and spin up local preview server before executing E2E tests
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});