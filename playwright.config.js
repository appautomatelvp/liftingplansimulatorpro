import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5174',
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
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 120000
  }
});
