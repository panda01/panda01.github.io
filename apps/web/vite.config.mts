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
  server: {
    host: localLoopbackHost,
    port: webApplicationPort,
    strictPort: true,
    proxy: {
      '/api': { target: `http://${localLoopbackHost}:${String(apiServerPort)}` },
    },
  },
});
