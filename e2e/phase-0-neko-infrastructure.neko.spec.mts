import { chromium, expect, test } from '@playwright/test';
import { developmentPorts, localLoopbackHost } from '@khalah/shared';

const nekoHttpBaseUrl = `http://${localLoopbackHost}:${String(developmentPorts.nekoHttp)}`;
const chromeDevtoolsProtocolBaseUrl = `http://${localLoopbackHost}:${String(developmentPorts.chromeDevtoolsProtocol)}`;

/**
 * Reads a required secret that playwright.config.mts loaded from the local .env file.
 * @param environmentVariableName - The name of the variable to read.
 * @returns The variable's value.
 * @throws {Error} When the variable is missing, so the test fails loudly instead of skipping.
 */
function readRequiredEnvironmentVariable(environmentVariableName: string): string {
  const environmentVariableValue = process.env[environmentVariableName];
  if (environmentVariableValue === undefined || environmentVariableValue === '') {
    throw new Error(`${environmentVariableName} must be set in .env (see .env.example).`);
  }
  return environmentVariableValue;
}

test.describe('Phase 0: neko browser infrastructure', () => {
  test('the neko container reports healthy', async ({ request }) => {
    const healthResponse = await request.get(`${nekoHttpBaseUrl}/health`);

    expect(healthResponse.ok()).toBe(true);
  });

  test('the Chrome DevTools Protocol endpoint is reachable', async ({ request }) => {
    const versionResponse = await request.get(`${chromeDevtoolsProtocolBaseUrl}/json/version`);

    expect(versionResponse.ok()).toBe(true);
    const versionBody = (await versionResponse.json()) as { Browser?: string };
    expect(versionBody.Browser).toMatch(/Chrom/);
  });

  test('navigating the remote Chromium over CDP sets the expected page title', async () => {
    const remoteBrowser = await chromium.connectOverCDP(chromeDevtoolsProtocolBaseUrl);
    try {
      const remoteBrowserContext = remoteBrowser.contexts()[0];
      expect(remoteBrowserContext).toBeDefined();
      const remotePage =
        remoteBrowserContext?.pages()[0] ?? (await remoteBrowserContext?.newPage());
      expect(remotePage).toBeDefined();

      await remotePage?.goto(
        'data:text/html,<title>neko fixture ready</title><h1>neko fixture ready</h1>',
      );

      expect(await remotePage?.title()).toBe('neko fixture ready');
    } finally {
      await remoteBrowser.close();
    }
  });

  test('the neko stream page plays the remote browser video', async ({ page }) => {
    const nekoUserPassword = readRequiredEnvironmentVariable('NEKO_USER_PASSWORD');
    const streamPageUrl = `${nekoHttpBaseUrl}/?cast=1&usr=e2e-viewer&pwd=${encodeURIComponent(nekoUserPassword)}`;

    await page.goto(streamPageUrl);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const streamVideoElement = document.querySelector('video');
            const hasDecodedVideoFrames =
              streamVideoElement !== null &&
              streamVideoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
              streamVideoElement.videoWidth > 0;
            return hasDecodedVideoFrames && !streamVideoElement.paused;
          }),
        { timeout: 30_000 },
      )
      .toBe(true);
  });
});
