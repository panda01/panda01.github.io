import { AxeBuilder } from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Opens the desktop and waits until the boot screen has finished and the desktop is interactive.
 * @param page - The Playwright page to load the desktop into.
 * @returns Resolves once the menu bar and Dock are visible and the boot screen is gone.
 */
export async function openDesktopAndWaitForBoot(page: Page): Promise<void> {
  await page.goto('/');
  await waitForDesktopBootToFinish(page);
}

/**
 * Waits for an already-loading desktop (for example after a reload) to finish booting.
 * @param page - The page showing the desktop.
 * @returns Resolves once the menu bar and Dock are visible and the boot screen is gone.
 */
export async function waitForDesktopBootToFinish(page: Page): Promise<void> {
  await expect(page.getByRole('progressbar', { name: 'Starting up' })).toBeHidden({
    timeout: 15_000,
  });
  await expect(page.getByRole('navigation', { name: 'Menu bar' })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Dock' })).toBeVisible();
}

/**
 * Returns the bounding box of a visible element, failing the test if it has none.
 * @param elementLocator - The element to measure.
 * @returns The element's position and size in CSS pixels.
 */
export async function measureElement(
  elementLocator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const elementBox = await elementLocator.boundingBox();
  expect(elementBox, 'element should be visible and have a bounding box').not.toBeNull();
  return elementBox ?? { x: 0, y: 0, width: 0, height: 0 };
}

/**
 * Presses the mouse on the centre of an element and drags it by an offset in small steps, the way a
 * person would.
 * @param page - The page containing the element.
 * @param dragHandleLocator - The element to grab (for example a window title bar).
 * @param horizontalOffset - Pixels to move right (negative moves left).
 * @param verticalOffset - Pixels to move down (negative moves up).
 * @returns Resolves after the mouse button is released.
 */
export async function dragElementBy(
  page: Page,
  dragHandleLocator: Locator,
  horizontalOffset: number,
  verticalOffset: number,
): Promise<void> {
  const handleBox = await measureElement(dragHandleLocator);
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + horizontalOffset, startY + verticalOffset, { steps: 12 });
  await page.mouse.up();
}

/**
 * Runs an axe accessibility scan and returns only the serious and critical violations.
 * @param page - The page to scan.
 * @returns A compact description of each serious or critical violation (empty when there are none).
 */
export async function findSeriousAccessibilityViolations(page: Page): Promise<string[]> {
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  return accessibilityScanResults.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`,
    );
}
