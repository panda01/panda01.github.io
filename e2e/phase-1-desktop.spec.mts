import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  dragElementBy,
  findSeriousAccessibilityViolations,
  measureElement,
  openDesktopAndWaitForBoot,
  waitForDesktopBootToFinish,
} from './support/desktop-test-helpers.mts';

// Reduced motion skips the window open/minimize scale animations, so window positions and sizes can
// be measured exactly instead of mid-animation. (The Dock's hover magnification is not an animation
// that reduced motion turns off, so it is still tested.)
test.use({ locale: 'en-US', timezoneId: 'America/New_York', reducedMotion: 'reduce' });

/**
 * Opens About This Mac from the Dock and returns its window.
 * @param page - The page showing the desktop.
 * @returns The About This Mac window locator.
 */
async function openAboutThisMacFromDock(page: Page) {
  await page
    .getByRole('toolbar', { name: 'Dock' })
    .getByRole('button', { name: 'About This Mac' })
    .click();
  const aboutThisMacWindow = page.getByRole('dialog', { name: 'About This Mac' });
  await expect(aboutThisMacWindow).toBeVisible();
  return aboutThisMacWindow;
}

/**
 * Opens the Get Info window for a desktop item through its context menu.
 * @param page - The page showing the desktop.
 * @param desktopItemName - The visible name of the desktop item.
 * @returns The item's Get Info window locator.
 */
async function openGetInfoForDesktopItem(page: Page, desktopItemName: string) {
  await page
    .getByRole('list', { name: 'Desktop items' })
    .getByRole('button', { name: desktopItemName })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Get Info' }).click();
  const getInfoWindow = page.getByRole('dialog', { name: `${desktopItemName} Info` });
  await expect(getInfoWindow).toBeVisible();
  return getInfoWindow;
}

test.describe('Phase 1: desktop shell', () => {
  test('first visit shows the boot screen, then the desktop with menu bar, Dock and seeded icons', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('progressbar', { name: 'Starting up' })).toBeVisible();
    await waitForDesktopBootToFinish(page);

    await expect(page.getByRole('main', { name: 'khalah.com desktop' })).toBeVisible();
    await expect(page.getByTestId('desktop-wallpaper')).toBeVisible();
    const desktopItems = page.getByRole('list', { name: 'Desktop items' });
    for (const seededItemName of [
      'About Me.txt',
      'Resume.pdf',
      'Cover Letter.pdf',
      'GitHub',
      'LinkedIn',
      'Musings',
      'Email',
    ]) {
      await expect(desktopItems.getByRole('button', { name: seededItemName })).toBeVisible();
    }
    await expect(desktopItems.getByRole('button', { name: 'Projects', exact: true })).toHaveCount(
      0,
    );
  });

  test('the menu bar shows Finder when no window is focused and a clock with the current time', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-11T09:41:00') });
    await openDesktopAndWaitForBoot(page);
    const menuBar = page.getByRole('navigation', { name: 'Menu bar' });

    await expect(menuBar.getByRole('button', { name: 'Finder', exact: true })).toBeVisible();
    await expect(menuBar.getByText('Sun Oct 11 9:41 AM')).toBeVisible();
  });

  test('hovering the Dock magnifies icons, and launching an app opens its window with a running indicator', async ({
    page,
  }) => {
    await openDesktopAndWaitForBoot(page);
    const dockAboutThisMacButton = page
      .getByRole('toolbar', { name: 'Dock' })
      .getByRole('button', { name: 'About This Mac' });

    await page.mouse.move(5, 5);
    const restingIconWidth = (await measureElement(dockAboutThisMacButton)).width;
    await dockAboutThisMacButton.hover();
    await expect
      .poll(async () => (await measureElement(dockAboutThisMacButton)).width)
      .toBeGreaterThan(restingIconWidth * 1.2);

    await expect(dockAboutThisMacButton).toHaveAttribute('data-running', 'false');
    await openAboutThisMacFromDock(page);
    await expect(dockAboutThisMacButton).toHaveAttribute('data-running', 'true');
    await expect(
      page
        .getByRole('navigation', { name: 'Menu bar' })
        .getByRole('button', { name: 'About This Mac', exact: true }),
    ).toBeVisible();
  });

  test('a window moves by its title bar and cannot be dragged above the menu bar', async ({
    page,
  }) => {
    await openDesktopAndWaitForBoot(page);
    const aboutThisMacWindow = await openAboutThisMacFromDock(page);
    const titleBar = aboutThisMacWindow.getByTestId('window-title-bar');

    const boxBeforeDrag = await measureElement(aboutThisMacWindow);
    await dragElementBy(page, titleBar, 150, 80);
    const boxAfterDrag = await measureElement(aboutThisMacWindow);
    expect(boxAfterDrag.x).toBeCloseTo(boxBeforeDrag.x + 150, -1);
    expect(boxAfterDrag.y).toBeCloseTo(boxBeforeDrag.y + 80, -1);

    await dragElementBy(page, titleBar, 0, -2000);
    const menuBarBox = await measureElement(page.getByRole('navigation', { name: 'Menu bar' }));
    const boxAfterDragUp = await measureElement(aboutThisMacWindow);
    expect(boxAfterDragUp.y).toBeGreaterThanOrEqual(menuBarBox.y + menuBarBox.height - 1);
  });

  test('a window follows the pointer while its title bar is being dragged', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const aboutThisMacWindow = await openAboutThisMacFromDock(page);
    const titleBarBox = await measureElement(aboutThisMacWindow.getByTestId('window-title-bar'));
    const pressX = titleBarBox.x + titleBarBox.width / 2;
    const pressY = titleBarBox.y + titleBarBox.height / 2;

    const boxBeforeDrag = await measureElement(aboutThisMacWindow);
    await page.mouse.move(pressX, pressY);
    await page.mouse.down();
    await page.mouse.move(pressX + 150, pressY + 80, { steps: 12 });
    const boxWhileDragging = await measureElement(aboutThisMacWindow);
    expect(boxWhileDragging.x).toBeCloseTo(boxBeforeDrag.x + 150, -1);
    expect(boxWhileDragging.y).toBeCloseTo(boxBeforeDrag.y + 80, -1);

    await page.mouse.up();
    const boxAfterRelease = await measureElement(aboutThisMacWindow);
    expect(boxAfterRelease.x).toBeCloseTo(boxWhileDragging.x, 0);
    expect(boxAfterRelease.y).toBeCloseTo(boxWhileDragging.y, 0);
  });

  test('a window resizes from its bottom-right corner', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const aboutThisMacWindow = await openAboutThisMacFromDock(page);

    const boxBeforeResize = await measureElement(aboutThisMacWindow);
    await dragElementBy(
      page,
      aboutThisMacWindow.getByTestId('window-resize-handle-bottom-right'),
      120,
      70,
    );
    const boxAfterResize = await measureElement(aboutThisMacWindow);

    expect(boxAfterResize.width).toBeCloseTo(boxBeforeResize.width + 120, -1);
    expect(boxAfterResize.height).toBeCloseTo(boxBeforeResize.height + 70, -1);
  });

  test('the traffic lights minimize into the Dock, restore, zoom, and close a window', async ({
    page,
  }) => {
    await openDesktopAndWaitForBoot(page);
    const dock = page.getByRole('toolbar', { name: 'Dock' });
    const aboutThisMacWindow = await openAboutThisMacFromDock(page);

    await aboutThisMacWindow.getByRole('button', { name: 'Minimize' }).click();
    await expect(aboutThisMacWindow).toBeHidden();
    const minimizedDockItem = dock.getByRole('button', { name: 'About This Mac (minimized)' });
    await expect(minimizedDockItem).toBeVisible();
    await minimizedDockItem.click();
    await expect(aboutThisMacWindow).toBeVisible();
    await expect(minimizedDockItem).toBeHidden();

    await aboutThisMacWindow.getByRole('button', { name: 'Zoom' }).click();
    const viewportSize = page.viewportSize() ?? { width: 0, height: 0 };
    await expect
      .poll(async () => (await measureElement(aboutThisMacWindow)).width)
      .toBeGreaterThan(viewportSize.width - 4);

    await aboutThisMacWindow.getByRole('button', { name: 'Close' }).click();
    await expect(aboutThisMacWindow).toBeHidden();
    await expect(dock.getByRole('button', { name: 'About This Mac' })).toHaveAttribute(
      'data-running',
      'false',
    );
  });

  test('clicking a window that is behind another brings it to the front', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const aboutMeInfoWindow = await openGetInfoForDesktopItem(page, 'About Me.txt');
    const resumeInfoWindow = await openGetInfoForDesktopItem(page, 'Resume.pdf');
    await expect(resumeInfoWindow).toHaveAttribute('data-focused', 'true');
    await expect(aboutMeInfoWindow).toHaveAttribute('data-focused', 'false');

    // A point covered by both windows: the newer (Resume) window is cascaded below/right of the older one.
    const resumeInfoBox = await measureElement(resumeInfoWindow);
    const overlapPoint = { x: resumeInfoBox.x + 20, y: resumeInfoBox.y + 60 };
    /**
     * Checks which window is topmost at the overlap point.
     * @param windowName - Accessible name of the window expected on top.
     * @returns Whether that window is the topmost element at the overlap point.
     */
    const isPointInsideWindow = (windowName: string) =>
      page.evaluate(
        ({ x, y, name }) =>
          document
            .elementFromPoint(x, y)
            ?.closest('[role="dialog"]')
            ?.getAttribute('aria-label') === name,
        { ...overlapPoint, name: windowName },
      );
    // Polled: the "Get Info" menu's closing transition briefly covers the screen.
    await expect.poll(() => isPointInsideWindow('Resume.pdf Info')).toBe(true);

    await aboutMeInfoWindow.getByTestId('window-title-bar').click();

    await expect(aboutMeInfoWindow).toHaveAttribute('data-focused', 'true');
    await expect.poll(() => isPointInsideWindow('About Me.txt Info')).toBe(true);
  });

  test('right-clicking the desktop creates a new folder that survives a reload', async ({
    page,
  }) => {
    await openDesktopAndWaitForBoot(page);

    await page
      .getByTestId('desktop-surface')
      .click({ button: 'right', position: { x: 600, y: 400 } });
    await page.getByRole('menuitem', { name: 'New Folder' }).click();
    const desktopItems = page.getByRole('list', { name: 'Desktop items' });
    await expect(
      desktopItems.getByRole('button', { name: 'untitled folder', exact: true }),
    ).toBeVisible();

    await page.reload();
    await waitForDesktopBootToFinish(page);
    await expect(
      desktopItems.getByRole('button', { name: 'untitled folder', exact: true }),
    ).toBeVisible();
  });

  test('window positions survive a reload', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const aboutThisMacWindow = await openAboutThisMacFromDock(page);
    await dragElementBy(page, aboutThisMacWindow.getByTestId('window-title-bar'), 120, 60);
    const boxBeforeReload = await measureElement(aboutThisMacWindow);

    await page.reload();
    await waitForDesktopBootToFinish(page);

    await expect(aboutThisMacWindow).toBeVisible();
    const boxAfterReload = await measureElement(aboutThisMacWindow);
    expect(boxAfterReload.x).toBeCloseTo(boxBeforeReload.x, 0);
    expect(boxAfterReload.y).toBeCloseTo(boxBeforeReload.y, 0);
  });

  test('Reset Desktop restores the seeded desktop', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const desktopItems = page.getByRole('list', { name: 'Desktop items' });
    await page
      .getByTestId('desktop-surface')
      .click({ button: 'right', position: { x: 600, y: 400 } });
    await page.getByRole('menuitem', { name: 'New Folder' }).click();
    await expect(
      desktopItems.getByRole('button', { name: 'untitled folder', exact: true }),
    ).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Menu bar' })
      .getByRole('button', { name: 'System menu' })
      .click();
    await page.getByRole('menuitem', { name: 'Reset Desktop…' }).click();
    const resetConfirmation = page.getByRole('dialog', { name: 'Reset Desktop?' });
    await resetConfirmation.getByRole('button', { name: 'Reset' }).click();

    await waitForDesktopBootToFinish(page);
    await expect(
      desktopItems.getByRole('button', { name: 'untitled folder', exact: true }),
    ).toBeHidden();
    await expect(desktopItems.getByRole('button', { name: 'About Me.txt' })).toBeVisible();
  });

  test('Option-key shortcuts minimize and close the focused window', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const aboutThisMacWindow = await openAboutThisMacFromDock(page);

    await aboutThisMacWindow.getByTestId('window-title-bar').click();
    await page.keyboard.press('Alt+KeyM');
    await expect(aboutThisMacWindow).toBeHidden();
    await page
      .getByRole('toolbar', { name: 'Dock' })
      .getByRole('button', { name: 'About This Mac (minimized)' })
      .click();
    await expect(aboutThisMacWindow).toBeVisible();

    await aboutThisMacWindow.getByTestId('window-title-bar').click();
    await page.keyboard.press('Alt+KeyW');
    await expect(aboutThisMacWindow).toBeHidden();
  });

  test('the Dock is keyboard navigable with arrow keys and Enter', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const dock = page.getByRole('toolbar', { name: 'Dock' });
    const dockItems = dock.getByRole('button');

    await dockItems.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(dockItems.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(dockItems.first()).toBeFocused();

    // Finder is the first Dock item since Phase 2; About This Mac is the second.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'About This Mac' })).toBeVisible();
  });

  test('the desktop with an open window has no serious accessibility violations', async ({
    page,
  }) => {
    await openDesktopAndWaitForBoot(page);
    await openAboutThisMacFromDock(page);

    expect(await findSeriousAccessibilityViolations(page)).toEqual([]);
  });
});
