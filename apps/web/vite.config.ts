import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { webManifest } from './plugins/webManifest.ts';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web',
  plugins: [
    react(),
    webManifest(),
    // Tells Nx when the dev or preview server is listening, so the e2e tests start right then
    nxReadySignal(),
    // Service worker that keeps the whole app on the device, so it opens and works offline
    VitePWA({
      // The manifests come from webManifest(), one per language
      manifest: false,
      // Registered in src/main.tsx
      injectRegister: false,
      // No skipWaiting: a new version takes over the next time the app opens, never in the middle
      // of a scan (the documents only live in the page memory)
      registerType: 'prompt',
      workbox: {
        // Everything the app needs, including opencv.js and the language manifests
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // opencv.js is ~9 MB; the 2 MB default would leave it out and break detection offline
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        // On the first visit, the page also uses the files just stored (opencv.js included) instead
        // of downloading them again. Safe: there is no older version to mix with, and updates still
        // wait for the app to close
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    // Resolves @devantage/docscanify to the library's source, through the tsconfig paths
    tsconfigPaths: true,
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // Both the app and docscanify use pdf-lib: keep a single copy in the bundle
    dedupe: ['pdf-lib'],
  },
  server: {
    host: true,
    // The app's own package.json makes Vite treat apps/web as the workspace root; the library
    // source and node_modules live at the monorepo root
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
  },
  build: {
    outDir: '../../dist/apps/web',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
}));
