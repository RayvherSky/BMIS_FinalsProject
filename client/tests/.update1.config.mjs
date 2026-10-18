import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'ticket-requests.spec.js', workers: 1, timeout: 20000,
  expect: { timeout: 5000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3002', channel: 'chrome', viewport: { width: 1440, height: 1000 } },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 3002 --strictPort', cwd: '..', url: 'http://127.0.0.1:3002', reuseExistingServer: false },
});
