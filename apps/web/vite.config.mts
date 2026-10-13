import { defineConfig } from 'vite';
import viteReactPlugin from '@vitejs/plugin-react';
import { developmentPorts, localLoopbackHost, resolvePortFromEnvironment } from '@khalah/shared';

// WEB_PORT / API_PORT let the Playwright test servers run on their own ports (see playwright.config.mts).
const webApplicationPort = resolvePortFromEnvironment(
  process.env,
  'WEB_PORT',
  developmentPorts.webApplication,
);
const apiServerPort = resolvePortFromEnvironment(
  process.env,
  'API_PORT',
  developmentPorts.apiServer,
);

export default defineConfig({
  plugins: [viteReactPlugin()],
  // Vite's start-up dependency scan only reads .js/.ts/.tsx/.mjs files, and this project's modules
  // are .mts. Without this, libraries reached only through .mts files (dexie, fuse.js, react-pdf,
  // the Finder icons, ...) were found while the app was in use, and Vite reloaded the whole page
  // each time (the "desktop flashes" seen during the Phase 2 check).
  optimizeDeps: { extensions: ['.mts'] },
  server: {
    host: localLoopbackHost,
    port: webApplicationPort,
    strictPort: true,
    proxy: {
      '/api': { target: `http://${localLoopbackHost}:${String(apiServerPort)}` },
    },
  },
});
