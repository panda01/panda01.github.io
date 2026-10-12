import { expect, test } from '@playwright/test';
import type { HealthCheckResponse } from '@khalah/shared';

test.describe('Phase 0: foundation', () => {
  test('the homepage renders the application root without console errors', async ({ page }) => {
    const consoleErrorMessages: string[] = [];
    page.on('console', (consoleMessage) => {
      if (consoleMessage.type() === 'error') {
        consoleErrorMessages.push(consoleMessage.text());
      }
    });
    page.on('pageerror', (uncaughtPageError) => {
      consoleErrorMessages.push(uncaughtPageError.message);
    });

    await page.goto('/');

    await expect(page.getByRole('main', { name: 'khalah.com desktop' })).toBeVisible();
    expect(consoleErrorMessages).toEqual([]);
  });

  // Regression: real browsers request a favicon (headless test browsers do not), and a missing one
  // showed up as a 404 console error during Phase 0 manual verification.
  test('the page declares an SVG favicon that loads', async ({ page, request }) => {
    await page.goto('/');

    const declaredFaviconPath = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(declaredFaviconPath).toBe('/favicon.svg');

    const faviconResponse = await request.get('/favicon.svg');
    expect(faviconResponse.status()).toBe(200);
    expect(faviconResponse.headers()['content-type']).toContain('image/svg+xml');
  });

  test('GET /api/health reports ok through the web dev-server proxy', async ({ request }) => {
    const healthResponse = await request.get('/api/health');

    expect(healthResponse.status()).toBe(200);
    const expectedHealthBody: HealthCheckResponse = { status: 'ok' };
    expect(await healthResponse.json()).toEqual(expectedHealthBody);
  });
});
