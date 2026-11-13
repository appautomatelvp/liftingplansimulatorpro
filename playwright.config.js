import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  workers: 1,
  expect: {
    timeout: 8000
  },
  fullyParallel: false,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:5178',
    trace: 'on-first-retry',
    viewport: { width: 1920, height: 1080 }
  },
  projects: [
    {
      name: 'fhd-1080p',
      use: { viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'hd-720p',
      use: { viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'laptop-768p',
      use: { viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'qhd-1440p',
      use: { viewport: { width: 2560, height: 1440 } },
    }
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5178 --strictPort',
    url: 'http://127.0.0.1:5178',
    env: {
      VITE_APP_ENV: 'development',
      VITE_AUTH_DEV_BYPASS: 'true'
    },
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true',
    timeout: 120000
  }
});
