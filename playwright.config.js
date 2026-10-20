import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4173/problem-space-map/', viewport: { width: 1440, height: 900 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  // One map per run: the build inherits MAP from the environment (`MAP=examples/<name>/map.json npm run e2e`),
  // and a running preview is never reused, so the page always matches the current MAP.
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/problem-space-map/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
