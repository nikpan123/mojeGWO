import { defineConfig, devices } from '@playwright/test';
import { readSettings, readBaseSettings, validateSettings } from './lib/settings.mjs';

const services=process.env.MOJE_GWO_SUITE==='services';
const settings = services?readBaseSettings():validateSettings(readSettings());
export default defineConfig({
  testDir: './tests',
  testMatch: services?'service-health.spec.mjs':'health.spec.mjs',
  globalSetup: services?undefined:'./scripts/auth-setup.mjs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 45_000,
  globalTimeout: services?90_000:300_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['./dashboard/live-reporter.mjs'],
    ['html', { open: 'never', outputFolder: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR || 'playwright-report' }],
    ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_FILE || 'test-results/results.json' }],
    ['junit', { outputFile: process.env.PLAYWRIGHT_JUNIT_OUTPUT_FILE || 'test-results/junit.xml' }]
  ],
  use: {
    baseURL: settings.baseURL,
    launchOptions: {slowMo:[0,250,700].includes(Number(process.env.MOJE_GWO_SLOW_MO))?Number(process.env.MOJE_GWO_SLOW_MO):0},
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: services?'off':'retain-on-failure',
    acceptDownloads: false,
    ignoreHTTPSErrors: false
  },
  projects: [{ name: 'test-chromium', use: { ...devices['Desktop Chrome'], viewport:{width:1920,height:1080}, screen:{width:1920,height:1080} } }]
});
