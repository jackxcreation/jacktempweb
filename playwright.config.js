// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e', // 🔥 Sirf e2e folder ke andar ke tests run honge
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ], // 🔥 Enhanced multi-reporter setup for clear terminal and HTML logs

  // 🔥 Output directory for test failure artifacts (traces, screenshots, videos)
  outputDir: 'test-results/',

  use: {
    headless: true,
    // 🔥 Dynamic baseURL configuration to prevent hitting production during testing
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure', // 🔥 Capture screenshot automatically when a test fails
    video: 'retain-on-failure',    // 🔥 Retain video recording on failure for quick diagnosis
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    /* 🔥 Uncomment below if you want cross-browser testing in CI later
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    */
  ],

  // 🔥 Automatically build and spin up local preview server before executing E2E tests
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});