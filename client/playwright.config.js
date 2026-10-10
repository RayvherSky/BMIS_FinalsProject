import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: process.env.BMIS_FRONTEND_ONLY ? '**/frontend-contract.spec.js' : '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3001',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: [
    ...(!process.env.BMIS_FRONTEND_ONLY ? [
    {
      command: 'node ../server/scripts/test-server.js',
      url: 'http://127.0.0.1:5001/',
      reuseExistingServer: false,
      timeout: 300000,
    },
    ] : []),
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 3001 --strictPort',
      url: 'http://127.0.0.1:3001',
      env: { BMIS_API_TARGET: 'http://127.0.0.1:5001' },
      reuseExistingServer: false,
    },
  ],
});
