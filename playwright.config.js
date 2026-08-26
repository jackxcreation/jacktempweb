const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e', // 🔥 Sirf e2e folder ke andar ke tests run honge
  timeout: 30000,
  fullyParallel: true,
  use: {
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});