import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  findSeriousAccessibilityViolations,
  openDesktopAndWaitForBoot,
  waitForDesktopBootToFinish,
} from './support/desktop-test-helpers.mts';
import {
  chooseFromContextMenu,
  createNamedFolderInFinder,
  desktopItemNamed,
  dragElementOnto,
  findWindowTitled,
  folderContentsOf,
  folderItemIn,
  goToSidebarLocation,
  openFinderFromDock,
  storeFileInVisitorDesktop,
  stubExternalWebsites,
} from './support/finder-test-helpers.mts';

// Reduced motion skips window animations so windows can be found and measured immediately.
test.use({ locale: 'en-US', timezoneId: 'America/New_York', reducedMotion: 'reduce' });

/** The seeded About Me text, read from the repository so the test follows the real content. */
const aboutMeFileText = readFileSync(
  new URL('../content/Desktop/About Me.txt', import.meta.url),
  'utf8',
);
const aboutMeFirstLine = aboutMeFileText.split('\n')[0]?.trim() ?? '';

/** An 8×8 red PNG, used as an image fixture for Quick Look. */
const redSquarePngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGO4aaCKFTEMLQkArXtLgYoZLSQAAAAASUVORK5CYII=';

test.describe('Phase 2: Finder, Quick Look and Spotlight', () => {
  test('Finder opens from the Dock showing the home folder and the sidebar locations', async ({
    page,
  }) => {
    await openDesktopAndWaitForBoot(page);
    const dockFinderButton = page
      .getByRole('toolbar', { name: 'Dock' })
      .getByRole('button', { name: 'Finder', exact: true });
    await expect(dockFinderButton).toHaveAttribute('data-running', 'false');

    const homeWindow = await openFinderFromDock(page);

    await expect(dockFinderButton).toHaveAttribute('data-running', 'true');
    const sidebar = homeWindow.getByRole('navigation', { name: 'Sidebar' });
    for (const locationName of ['Desktop', 'Documents', 'Downloads', 'Projects', 'Trash']) {
      await expect(sidebar.getByRole('button', { name: locationName, exact: true })).toBeVisible();
    }
    for (const homeFolderName of ['Desktop', 'Documents', 'Downloads', 'Projects']) {
      await expect(folderItemIn(homeWindow, homeFolderName)).toBeVisible();
    }
  });

  test('navigating into folders updates the title and path bar, and back/forward return', async ({
    page,
  }) => {
    await openDesktopAndWaitForBoot(page);
    const projectsWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Projects',
    );

    await expect(folderItemIn(projectsWindow, 'Example Project One')).toBeVisible();
    await expect(folderItemIn(projectsWindow, 'Example Project Two')).toBeVisible();
    await expect(
      projectsWindow.getByRole('navigation', { name: 'Path' }).getByRole('button'),
    ).toHaveText(['Macintosh HD', 'Users', 'guest', 'Projects']);

    await folderItemIn(projectsWindow, 'Example Project One').dblclick();
    const projectOneWindow = findWindowTitled(page, 'Example Project One');
    await expect(folderItemIn(projectOneWindow, 'README.txt')).toBeVisible();
    await expect(
      projectOneWindow.getByRole('navigation', { name: 'Path' }).getByRole('button'),
    ).toHaveText(['Macintosh HD', 'Users', 'guest', 'Projects', 'Example Project One']);

    await projectOneWindow.getByRole('button', { name: 'Back' }).click();
    await expect(projectsWindow).toBeVisible();
    await projectsWindow.getByRole('button', { name: 'Forward' }).click();
    await expect(projectOneWindow).toBeVisible();

    await projectOneWindow
      .getByRole('navigation', { name: 'Path' })
      .getByRole('button', { name: 'guest' })
      .click();
    await expect(findWindowTitled(page, 'guest')).toBeVisible();
  });

  test('the icon, list and column views can be switched', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const projectsWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Projects',
    );

    await projectsWindow.getByRole('button', { name: 'as List' }).click();
    const contentsTable = projectsWindow.getByRole('table', { name: 'Folder contents' });
    await expect(contentsTable.getByRole('columnheader')).toHaveText([
      'Name',
      'Date Modified',
      'Size',
      'Kind',
    ]);
    await expect(contentsTable.getByRole('row', { name: /Example Project One/ })).toBeVisible();

    await projectsWindow.getByRole('button', { name: 'as Columns' }).click();
    await expect(projectsWindow.getByRole('list', { name: 'guest', exact: true })).toBeVisible();
    await projectsWindow
      .getByRole('list', { name: 'Projects', exact: true })
      .getByRole('button', { name: 'Example Project One' })
      .click();
    const projectOneWindow = findWindowTitled(page, 'Example Project One');
    await expect(
      projectOneWindow
        .getByRole('list', { name: 'Example Project One', exact: true })
        .getByRole('button', { name: 'README.txt' }),
    ).toBeVisible();

    await projectOneWindow.getByRole('button', { name: 'as Icons' }).click();
    await expect(folderItemIn(projectOneWindow, 'README.txt')).toBeVisible();
  });

  test('a new folder is named inline and can be renamed later', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const documentsWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Documents',
    );

    await folderContentsOf(documentsWindow).click({ button: 'right', position: { x: 8, y: 8 } });
    await page.getByRole('menuitem', { name: 'New Folder', exact: true }).click();
    const nameField = documentsWindow.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toBeFocused();
    await expect(nameField).toHaveValue('untitled folder');
    await nameField.fill('Notes');
    await nameField.press('Enter');
    await expect(folderItemIn(documentsWindow, 'Notes')).toBeVisible();

    await chooseFromContextMenu(page, folderItemIn(documentsWindow, 'Notes'), 'Rename');
    await nameField.fill('Ideas');
    await nameField.press('Enter');
    await expect(folderItemIn(documentsWindow, 'Ideas')).toBeVisible();
    await expect(folderItemIn(documentsWindow, 'Notes')).toBeHidden();
  });

  test('dragging a file onto a folder moves it, and Duplicate makes a copy', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const desktopFolderWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Desktop',
    );
    const archiveFolder = await createNamedFolderInFinder(page, desktopFolderWindow, 'Archive');

    await dragElementOnto(page, folderItemIn(desktopFolderWindow, 'About Me.txt'), archiveFolder);

    await expect(folderItemIn(desktopFolderWindow, 'About Me.txt')).toBeHidden();
    await expect(desktopItemNamed(page, 'About Me.txt')).toBeHidden();
    await archiveFolder.dblclick();
    const archiveWindow = findWindowTitled(page, 'Archive');
    await expect(folderItemIn(archiveWindow, 'About Me.txt')).toBeVisible();

    await chooseFromContextMenu(page, folderItemIn(archiveWindow, 'About Me.txt'), 'Duplicate');
    await expect(folderItemIn(archiveWindow, 'About Me copy.txt')).toBeVisible();
    await expect(folderItemIn(archiveWindow, 'About Me.txt')).toBeVisible();
  });

  test('items go to the Trash, can be put back, and the Trash can be emptied', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const desktopFolderWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Desktop',
    );

    await chooseFromContextMenu(
      page,
      folderItemIn(desktopFolderWindow, 'Resume.pdf'),
      'Move to Trash',
    );
    await expect(folderItemIn(desktopFolderWindow, 'Resume.pdf')).toBeHidden();
    await expect(desktopItemNamed(page, 'Resume.pdf')).toBeHidden();

    const trashWindow = await goToSidebarLocation(page, desktopFolderWindow, 'Trash');
    await expect(folderItemIn(trashWindow, 'Resume.pdf')).toBeVisible();
    await chooseFromContextMenu(page, folderItemIn(trashWindow, 'Resume.pdf'), 'Put Back');
    await expect(folderItemIn(trashWindow, 'Resume.pdf')).toBeHidden();
    await expect(desktopItemNamed(page, 'Resume.pdf')).toBeVisible();

    const backOnDesktopWindow = await goToSidebarLocation(page, trashWindow, 'Desktop');
    await dragElementOnto(
      page,
      folderItemIn(backOnDesktopWindow, 'About Me.txt'),
      backOnDesktopWindow
        .getByRole('navigation', { name: 'Sidebar' })
        .getByRole('button', { name: 'Trash', exact: true }),
    );
    await expect(desktopItemNamed(page, 'About Me.txt')).toBeHidden();

    const trashAgainWindow = await goToSidebarLocation(page, backOnDesktopWindow, 'Trash');
    await expect(folderItemIn(trashAgainWindow, 'About Me.txt')).toBeVisible();
    await trashAgainWindow.getByRole('button', { name: 'Empty', exact: true }).click();
    await expect(folderContentsOf(trashAgainWindow).getByRole('button')).toHaveCount(0);
  });

  test('a desktop icon dragged onto the Dock Trash is trashed, and the Dock Trash opens in Finder', async ({
    page,
  }) => {
    await openDesktopAndWaitForBoot(page);
    const dockTrashButton = page
      .getByRole('toolbar', { name: 'Dock' })
      .getByRole('button', { name: 'Trash', exact: true });

    await dragElementOnto(page, desktopItemNamed(page, 'About Me.txt'), dockTrashButton);
    await expect(desktopItemNamed(page, 'About Me.txt')).toBeHidden();

    await dockTrashButton.click();
    await expect(folderItemIn(findWindowTitled(page, 'Trash'), 'About Me.txt')).toBeVisible();
  });

  test('Get Info from Finder shows the kind, size and dates', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const desktopFolderWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Desktop',
    );

    await chooseFromContextMenu(page, folderItemIn(desktopFolderWindow, 'Resume.pdf'), 'Get Info');

    const resumeInfoWindow = findWindowTitled(page, 'Resume.pdf Info');
    await expect(resumeInfoWindow).toContainText('Kind:PDF Document');
    await expect(resumeInfoWindow).toContainText(/Size:\d+(\.\d)? KB/);
    await expect(resumeInfoWindow).toContainText('Created:');
    await expect(resumeInfoWindow).toContainText('Modified:');
  });

  test('files can be downloaded, and nothing can be uploaded', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const desktopFolderWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Desktop',
    );

    const downloadPromise = page.waitForEvent('download');
    await chooseFromContextMenu(
      page,
      folderItemIn(desktopFolderWindow, 'About Me.txt'),
      'Download',
    );
    const aboutMeDownload = await downloadPromise;
    expect(aboutMeDownload.suggestedFilename()).toBe('About Me.txt');
    expect(readFileSync(await aboutMeDownload.path(), 'utf8')).toBe(aboutMeFileText);

    // No upload command in any Finder menu, and no file chooser anywhere on the page.
    await folderItemIn(desktopFolderWindow, 'About Me.txt').click({ button: 'right' });
    await expect(page.getByRole('menuitem', { name: /upload/i })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await folderContentsOf(desktopFolderWindow).click({
      button: 'right',
      position: { x: 8, y: 8 },
    });
    await expect(page.getByRole('menuitem', { name: /upload/i })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('input[type="file"]')).toHaveCount(0);

    // A file dropped in from the computer is ignored, and the browser is stopped from opening it.
    const wasDropFromComputerBlocked = await page.evaluate(() => {
      const fileTransfer = new DataTransfer();
      fileTransfer.items.add(
        new File(['dropped from the computer'], 'Dropped.txt', { type: 'text/plain' }),
      );
      const dropTarget = document.querySelector('[aria-label="Folder contents"]');
      const dragOverEvent = new DragEvent('dragover', {
        dataTransfer: fileTransfer,
        bubbles: true,
        cancelable: true,
      });
      const dropEvent = new DragEvent('drop', {
        dataTransfer: fileTransfer,
        bubbles: true,
        cancelable: true,
      });
      dropTarget?.dispatchEvent(dragOverEvent);
      dropTarget?.dispatchEvent(dropEvent);
      return dragOverEvent.defaultPrevented && dropEvent.defaultPrevented;
    });
    expect(wasDropFromComputerBlocked).toBe(true);
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: 'Dropped.txt' })).toHaveCount(0);
  });

  test('Quick Look previews text and PDF files with the Space bar', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const desktopFolderWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Desktop',
    );

    await folderItemIn(desktopFolderWindow, 'About Me.txt').click();
    await page.keyboard.press('Space');
    const aboutMeQuickLook = findWindowTitled(page, 'About Me.txt');
    await expect(aboutMeQuickLook.getByText(aboutMeFirstLine)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(aboutMeQuickLook).toBeHidden();

    await folderItemIn(desktopFolderWindow, 'Resume.pdf').click();
    await page.keyboard.press('Space');
    const resumeQuickLook = findWindowTitled(page, 'Resume.pdf');
    await expect(resumeQuickLook.locator('canvas').first()).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(() =>
        resumeQuickLook
          .locator('canvas')
          .first()
          .evaluate((canvas) => (canvas as HTMLCanvasElement).width),
      )
      .toBeGreaterThan(100);
    await page.keyboard.press('Space');
    await expect(resumeQuickLook).toBeHidden();
  });

  test('Quick Look previews an image', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    await storeFileInVisitorDesktop(
      page,
      '/Users/guest/Documents',
      'Red Square.png',
      'image/png',
      redSquarePngBase64,
    );
    await page.reload();
    await waitForDesktopBootToFinish(page);
    const documentsWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Documents',
    );

    await folderItemIn(documentsWindow, 'Red Square.png').click();
    await page.keyboard.press('Space');

    const imagePreview = findWindowTitled(page, 'Red Square.png').getByRole('img', {
      name: 'Red Square.png',
    });
    await expect(imagePreview).toBeVisible();
    await expect
      .poll(() => imagePreview.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBe(8);
  });

  test('a link shortcut in Finder opens a real new browser tab', async ({ page, context }) => {
    await stubExternalWebsites(context);
    await openDesktopAndWaitForBoot(page);
    const desktopFolderWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Desktop',
    );

    const newTabPromise = context.waitForEvent('page');
    await folderItemIn(desktopFolderWindow, 'GitHub').dblclick();
    const gitHubTab = await newTabPromise;

    expect(gitHubTab.url()).toBe('https://github.com/panda01');
  });

  test('desktop icons open folders and aliases in Finder and files in Quick Look', async ({
    page,
  }) => {
    await openDesktopAndWaitForBoot(page);

    await desktopItemNamed(page, 'Projects').dblclick();
    const projectsWindow = findWindowTitled(page, 'Projects');
    await expect(folderItemIn(projectsWindow, 'Example Project One')).toBeVisible();

    await desktopItemNamed(page, 'About Me.txt').dblclick();
    await expect(findWindowTitled(page, 'About Me.txt').getByText(aboutMeFirstLine)).toBeVisible();
    await page.keyboard.press('Escape');

    await desktopItemNamed(page, 'Resume.pdf').click();
    await page.keyboard.press('Space');
    await expect(findWindowTitled(page, 'Resume.pdf')).toBeVisible();
  });

  test('Spotlight finds apps and files, even with a typo, and opens them', async ({ page }) => {
    await openDesktopAndWaitForBoot(page);
    const menuBar = page.getByRole('navigation', { name: 'Menu bar' });

    await menuBar.getByRole('button', { name: 'Spotlight' }).click();
    const spotlightSearch = page.getByRole('combobox', { name: 'Spotlight Search' });
    await expect(spotlightSearch).toBeFocused();
    await spotlightSearch.fill('resume');
    await expect(page.getByRole('option', { name: /Resume\.pdf/ })).toBeVisible();
    await spotlightSearch.press('Enter');
    await expect(findWindowTitled(page, 'Resume.pdf')).toBeVisible();
    await expect(spotlightSearch).toBeHidden();

    await page.keyboard.press('Alt+Space');
    await expect(spotlightSearch).toBeFocused();
    await spotlightSearch.fill('rsume');
    await expect(page.getByRole('option', { name: /Resume\.pdf/ })).toBeVisible();
    await spotlightSearch.fill('finder');
    await expect(page.getByRole('option', { name: /Finder/ }).first()).toBeVisible();
    await spotlightSearch.press('Enter');
    await expect(findWindowTitled(page, 'guest')).toBeVisible();

    await page.keyboard.press('Alt+Space');
    await expect(spotlightSearch).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(spotlightSearch).toBeHidden();
  });

  test('changes made in Finder appear live on the desktop and survive a reload', async ({
    page,
  }) => {
    await openDesktopAndWaitForBoot(page);
    const desktopFolderWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Desktop',
    );

    await createNamedFolderInFinder(page, desktopFolderWindow, 'Live Folder');
    await expect(desktopItemNamed(page, 'Live Folder')).toBeVisible();

    await page.reload();
    await waitForDesktopBootToFinish(page);
    await expect(desktopItemNamed(page, 'Live Folder')).toBeVisible();
    await expect(folderItemIn(findWindowTitled(page, 'Desktop'), 'Live Folder')).toBeVisible();
  });

  test('Finder, Quick Look and Spotlight have no serious accessibility violations', async ({
    page,
  }) => {
    await openDesktopAndWaitForBoot(page);
    const desktopFolderWindow = await goToSidebarLocation(
      page,
      await openFinderFromDock(page),
      'Desktop',
    );
    await desktopFolderWindow.getByRole('button', { name: 'as List' }).click();
    await expect(desktopFolderWindow.getByRole('table', { name: 'Folder contents' })).toBeVisible();
    await desktopItemNamed(page, 'About Me.txt').dblclick();
    await expect(findWindowTitled(page, 'About Me.txt')).toBeVisible();
    expect(await findSeriousAccessibilityViolations(page)).toEqual([]);

    await page
      .getByRole('navigation', { name: 'Menu bar' })
      .getByRole('button', { name: 'Spotlight' })
      .click();
    await page.getByRole('combobox', { name: 'Spotlight Search' }).fill('project');
    await expect(page.getByRole('option').first()).toBeVisible();
    expect(await findSeriousAccessibilityViolations(page)).toEqual([]);
  });
});
