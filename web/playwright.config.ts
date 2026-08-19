import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke suite. Boots the real API server (ts-node, from the repo root)
 * and the Vite dev server, so smoke tests exercise the same
 * spec-string → engine → manifest path the app uses in production.
 *
 * The `mobile` project exists from W1 so the W3 mobile-reference redirect
 * matrix has a home; today it runs the same smoke specs at a phone viewport.
 */
const PORT = Number(process.env.PW_WEB_PORT ?? 5173);
const API_PORT = Number(process.env.PW_API_PORT ?? 3001);

/**
 * Escape hatch for sandboxes that ship a preinstalled Chromium whose build
 * number does not match this @playwright/test release. CI installs the
 * matching browser instead and leaves this unset.
 */
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const launch = executablePath ? { launchOptions: { executablePath } } : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...launch } },
    { name: 'mobile', use: { ...devices['Pixel 5'], ...launch } },
  ],
  webServer: [
    {
      command: 'npm run server',
      cwd: '..',
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --port ${PORT} --strictPort`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
  ],
});
