import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Unit tests of the app, in jsdom. The browser flows (detection with OpenCV, export, camera,
// offline) are covered end to end by the *.e2e-spec.ts files, run by Playwright
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web/vitest',
  plugins: [react()],
  resolve: {
    // Resolves @devantage/docscanify to the library's source, as the app does
    tsconfigPaths: true,
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Only the PWA plugin of the build provides it: tests mock this stand-in
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test-support/pwaRegister.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'plugins/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/apps/web',
      include: ['src/**/*.{ts,tsx}', 'plugins/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.e2e-spec.ts',
        'src/test-setup.ts',
        'src/test-support/**',
        'src/vite-env.d.ts',
      ],
    },
  },
});
