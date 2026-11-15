import { defineConfig } from '@playwright/test';

process.env.VITE_USE_EMULATORS ??= 'true';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/auth.spec.js', '**/cms-roles.spec.js'],
  timeout: 90_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_AUTH_DEV_BYPASS: 'false',
      VITE_USE_EMULATORS: 'true',
      VITE_FIREBASE_PROJECT_ID: 'safelift3d-rules-test'
    }
  }
});
