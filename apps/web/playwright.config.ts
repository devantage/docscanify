import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

/** The default port of `vite preview`, so Nx infers the preview task from the command. */
const BASE_URL: string = 'http://localhost:4173';

const WORKSPACE_ROOT: string = path.join(import.meta.dirname, '../..');

const OUTPUT_DIR: string = path.join(
  WORKSPACE_ROOT,
  'dist/.playwright/apps/web',
);

/** One frame with the sample invoice, which the fake camera of Chrome films in a loop. */
const CAMERA_FEED: string = path.join(
  import.meta.dirname,
  'src/test-support/e2e/fixtures/camera.y4m',
);

/**
 * End-to-end tests of the web app, against its production build (`nx run web:preview`), in the
 * Google Chrome installed on the machine: the GitHub runners have it, so no browser is downloaded.
 * Each spec (`*.e2e-spec.ts`) sits next to the feature it covers.
 */
export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e-spec.ts',
  outputDir: path.join(OUTPUT_DIR, 'test-output'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(OUTPUT_DIR, 'report'), open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    locale: 'en-US',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-video-capture=${CAMERA_FEED}`,
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npx nx run web:preview',
    url: BASE_URL,
    cwd: WORKSPACE_ROOT,
    // Nx starts the preview before the tests (the e2e target depends on web:preview); without Nx,
    // Playwright starts it
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
