const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    include: ['tests/api.test.js'],
    environment: 'node',
  },
});