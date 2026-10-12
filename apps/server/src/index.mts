import { developmentPorts, localLoopbackHost, resolvePortFromEnvironment } from '@khalah/shared';
import { createApp } from './app.mts';

// API_PORT lets the Playwright test server run on its own port (see playwright.config.mts).
const apiServerPort = resolvePortFromEnvironment(
  process.env,
  'API_PORT',
  developmentPorts.apiServer,
);

createApp().listen(apiServerPort, localLoopbackHost, (listenError) => {
  if (listenError) {
    throw listenError;
  }
  console.log(`API server listening on http://${localLoopbackHost}:${String(apiServerPort)}`);
});
