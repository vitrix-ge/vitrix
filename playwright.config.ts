import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end checks of the published build (dist/vitrix/browser, made by `npm run build:pages`).
 * Pages are served under the real address https://vitrix-ge.github.io/vitrix/ from the local files,
 * and both servers are replaced by test data (e2e/fixtures.ts), so the tests need no network and
 * also check the real Content Security Policy. Run: npm run e2e
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'https://vitrix-ge.github.io/vitrix/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } },
    },
    { name: 'phone', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
});
