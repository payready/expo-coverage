import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e/playwright',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: 'http://localhost:8765' },
  webServer: {
    command: 'CI=1 bunx expo start --web --port 8765',
    url: 'http://localhost:8765',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
