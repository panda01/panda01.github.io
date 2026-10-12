import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { endToEndTestPorts, localLoopbackHost } from '@khalah/shared';

// The neko tests need the secrets from .env (see .env.example).
const isLocalEnvironmentFilePresent = existsSync('.env');
if (isLocalEnvironmentFilePresent) {
  process.loadEnvFile('.env');
}

const endToEndWebApplicationUrl = `http://${localLoopbackHost}:${String(endToEndTestPorts.webApplication)}`;
const endToEndPortEnvironment = {
  WEB_PORT: String(endToEndTestPorts.webApplication),
  API_PORT: String(endToEndTestPorts.apiServer),
};
const nekoSpecFilePattern = /\.neko\.spec\.mts$/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: endToEndWebApplicationUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: nekoSpecFilePattern,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'desktop-webkit',
      testIgnore: nekoSpecFilePattern,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'neko-setup',
      testMatch: /neko\.setup\.mts$/,
      teardown: 'neko-teardown',
    },
    {
      name: 'neko-teardown',
      testMatch: /neko\.teardown\.mts$/,
    },
    {
      name: 'neko',
      testMatch: nekoSpecFilePattern,
      dependencies: ['neko-setup'],
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run e2e:api',
      port: endToEndTestPorts.apiServer,
      env: endToEndPortEnvironment,
      reuseExistingServer: false,
    },
    {
      command: 'npm run e2e:web',
      url: endToEndWebApplicationUrl,
      env: endToEndPortEnvironment,
      reuseExistingServer: false,
    },
  ],
});
