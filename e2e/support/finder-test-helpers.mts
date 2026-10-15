import { expect } from '@playwright/test';
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { measureElement } from './desktop-test-helpers.mts';

/**
 * Finds a Finder (or Quick Look) window by its exact title. A Finder window's title is the name of
 * the folder it shows, so locating it by title also checks that navigation updated the title.
 * @param page - The page showing the desktop.
 * @param windowTitle - The exact window title, for example "Documents".
 * @returns The window locator.
 */
export function findWindowTitled(page: Page, windowTitle: string): Locator {
  return page.getByRole('dialog', { name: windowTitle, exact: true });
}

/**
 * Returns the icon-view contents list of a Finder window.
 * @param finderWindow - The Finder window.
 * @returns The list of the folder's items.
 */
export function folderContentsOf(finderWindow: Locator): Locator {
  return finderWindow.getByRole('list', { name: 'Folder contents' });
}

/**
 * Returns one item (an icon-view button) inside a Finder window's contents.
 * @param finderWindow - The Finder window.
 * @param itemName - The item's exact name.
 * @returns The item's button.
 */
export function folderItemIn(finderWindow: Locator, itemName: string): Locator {
  return folderContentsOf(finderWindow).getByRole('button', { name: itemName, exact: true });
}

/**
 * Returns one item on the desktop.
 * @param page - The page showing the desktop.
 * @param itemName - The item's exact name.
 * @returns The desktop icon's button.
 */
export function desktopItemNamed(page: Page, itemName: string): Locator {
  return page
    .getByRole('list', { name: 'Desktop items' })
    .getByRole('button', { name: itemName, exact: true });
}

/**
 * Opens Finder from the Dock. A new Finder window shows the home folder ("guest").
 * @param page - The page showing the desktop.
 * @returns The new Finder window.
 */
export async function openFinderFromDock(page: Page): Promise<Locator> {
  await page
    .getByRole('toolbar', { name: 'Dock' })
    .getByRole('button', { name: 'Finder', exact: true })
    .click();
  const homeFinderWindow = findWindowTitled(page, 'guest');
  await expect(homeFinderWindow).toBeVisible();
  return homeFinderWindow;
}

/**
 * Clicks a location in a Finder window's sidebar and waits for the window to show it.
 * @param page - The page showing the desktop.
 * @param finderWindow - The Finder window whose sidebar to use.
 * @param locationName - The sidebar entry, for example "Documents" or "Trash".
 * @returns The same window, now located by its new title.
 */
export async function goToSidebarLocation(
  page: Page,
  finderWindow: Locator,
  locationName: string,
): Promise<Locator> {
  await finderWindow
    .getByRole('navigation', { name: 'Sidebar' })
    .getByRole('button', { name: locationName, exact: true })
    .click();
  const relocatedFinderWindow = findWindowTitled(page, locationName);
  await expect(relocatedFinderWindow).toBeVisible();
  return relocatedFinderWindow;
}

/**
 * Opens an element's right-click menu and chooses one of its items.
 * @param page - The page showing the desktop.
 * @param menuOwner - The element to right-click.
 * @param menuItemName - The exact menu item to choose.
 * @returns Resolves after the menu item is clicked.
 */
export async function chooseFromContextMenu(
  page: Page,
  menuOwner: Locator,
  menuItemName: string,
): Promise<void> {
  await menuOwner.click({ button: 'right' });
  const menuItem = page.getByRole('menuitem', { name: menuItemName, exact: true });
  await expect(menuItem).toBeEnabled();
  await menuItem.click();
}

/**
 * Creates a folder through a Finder window's right-click menu and names it with the inline rename
 * field.
 * @param page - The page showing the desktop.
 * @param finderWindow - The Finder window to create the folder in.
 * @param folderName - The name to give the new folder.
 * @returns The new folder's icon.
 */
export async function createNamedFolderInFinder(
  page: Page,
  finderWindow: Locator,
  folderName: string,
): Promise<Locator> {
  await folderContentsOf(finderWindow).click({ button: 'right', position: { x: 8, y: 8 } });
  await page.getByRole('menuitem', { name: 'New Folder', exact: true }).click();
  const nameField = finderWindow.getByRole('textbox', { name: 'Name' });
  await expect(nameField).toBeFocused();
  await nameField.fill(folderName);
  await nameField.press('Enter');
  const newFolderIcon = folderItemIn(finderWindow, folderName);
  await expect(newFolderIcon).toBeVisible();
  return newFolderIcon;
}

/**
 * Drags one element onto another with the mouse, the way a person would: press, nudge to start the
 * drag, glide to the target, pause, release.
 * @param page - The page containing both elements.
 * @param draggedElement - The element to pick up.
 * @param dropTarget - The element to drop onto.
 * @returns Resolves after the mouse button is released.
 */
export async function dragElementOnto(
  page: Page,
  draggedElement: Locator,
  dropTarget: Locator,
): Promise<void> {
  const draggedBox = await measureElement(draggedElement);
  const startX = draggedBox.x + draggedBox.width / 2;
  const startY = draggedBox.y + draggedBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 12, startY + 12, { steps: 4 });
  const targetBox = await measureElement(dropTarget);
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 16,
  });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

/**
 * Makes link shortcuts that open real browser tabs land on a local stub page instead of the
 * public internet, so the tests only check where links point.
 * @param browserContext - The test's browser context.
 * @returns Resolves once the stub routes are installed.
 */
export async function stubExternalWebsites(browserContext: BrowserContext): Promise<void> {
  await browserContext.route(
    /^https:\/\/(github\.com|www\.linkedin\.com|khalah\.medium\.com)\//,
    (route) => route.fulfill({ contentType: 'text/html', body: '<title>Stubbed page</title>' }),
  );
}

/** A file or folder alias that a test stores straight into the visitor's saved desktop. */
type FixtureItem =
  | { kind: 'file'; name: string; mimeType: string; contentBase64: string }
  | { kind: 'link'; name: string; targetFolderPath: string };

/**
 * Stores a file directly in the visitor's saved desktop (IndexedDB), as a test fixture. Visitors
 * cannot upload files, so this is how a test gets an image onto the desktop. Reload the page
 * afterwards so the desktop reads it.
 * @param page - A page that has already booted the desktop once.
 * @param folderPath - Absolute path of an existing folder, for example "/Users/guest/Documents".
 * @param fileName - Name of the new file.
 * @param mimeType - The file's content type.
 * @param fileContentBase64 - The file's bytes, base64-encoded.
 * @returns Resolves once the file is stored.
 */
export async function storeFileInVisitorDesktop(
  page: Page,
  folderPath: string,
  fileName: string,
  mimeType: string,
  fileContentBase64: string,
): Promise<void> {
  await storeFixtureItemInVisitorDesktop(page, folderPath, {
    kind: 'file',
    name: fileName,
    mimeType,
    contentBase64: fileContentBase64,
  });
}

/**
 * Stores a folder alias directly in the visitor's saved desktop (IndexedDB), as a test fixture.
 * The default desktop has no folder alias of its own, and visitors cannot make one. Reload the
 * page afterwards so the desktop reads it.
 * @param page - A page that has already booted the desktop once.
 * @param folderPath - Absolute path of the existing folder that gets the alias, for example
 *   "/Users/guest/Desktop".
 * @param aliasName - Name of the new alias.
 * @param targetFolderPath - Absolute path of the folder the alias opens.
 * @returns Resolves once the alias is stored.
 */
export async function storeFolderAliasInVisitorDesktop(
  page: Page,
  folderPath: string,
  aliasName: string,
  targetFolderPath: string,
): Promise<void> {
  await storeFixtureItemInVisitorDesktop(page, folderPath, {
    kind: 'link',
    name: aliasName,
    targetFolderPath,
  });
}

/**
 * Stores one fixture item (a file or a folder alias) directly in the visitor's saved desktop
 * (IndexedDB), the way the desktop itself would store it.
 * @param page - A page that has already booted the desktop once.
 * @param folderPath - Absolute path of the existing folder that gets the item.
 * @param fixtureItem - The item to store.
 * @returns Resolves once the item is stored.
 */
async function storeFixtureItemInVisitorDesktop(
  page: Page,
  folderPath: string,
  fixtureItem: FixtureItem,
): Promise<void> {
  await page.evaluate(
    async (fixture) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const openRequest = indexedDB.open('khalah-desktop');
        openRequest.onsuccess = () => {
          resolve(openRequest.result);
        };
        openRequest.onerror = () => {
          reject(new Error('Could not open the desktop database.'));
        };
      });
      const nodeStore = database.transaction('nodes', 'readwrite').objectStore('nodes');
      const childByParentAndName = nodeStore.index('[parentId+name]');
      let parentId = 'root';
      for (const folderName of fixture.folderPath.split('/').filter(Boolean)) {
        const folderRecord = await new Promise<{ id: string } | undefined>((resolve) => {
          const lookup = childByParentAndName.get([parentId, folderName]);
          lookup.onsuccess = () => {
            resolve(lookup.result as { id: string } | undefined);
          };
        });
        if (folderRecord === undefined) {
          throw new Error(`Folder ${fixture.folderPath} does not exist.`);
        }
        parentId = folderRecord.id;
      }
      const { item } = fixture;
      const creationTime = Date.now();
      const sharedItemFields = {
        id: `fixture-${String(creationTime)}-${item.name}`,
        parentId,
        name: item.name,
        createdAt: creationTime,
        modifiedAt: creationTime,
      };
      let fixtureRecord: Record<string, unknown>;
      const isFileFixture = item.kind === 'file';
      if (isFileFixture) {
        const fileBytes = Uint8Array.from(atob(item.contentBase64), (character) =>
          character.charCodeAt(0),
        );
        fixtureRecord = {
          ...sharedItemFields,
          kind: 'file',
          mimeType: item.mimeType,
          sizeInBytes: fileBytes.byteLength,
          content: fileBytes,
        };
      } else {
        fixtureRecord = {
          ...sharedItemFields,
          kind: 'link',
          mimeType: 'application/x-link',
          sizeInBytes: 0,
          linkTarget: { kind: 'path', path: item.targetFolderPath },
        };
      }
      await new Promise<void>((resolve, reject) => {
        const addition = nodeStore.add(fixtureRecord);
        addition.onsuccess = () => {
          resolve();
        };
        addition.onerror = () => {
          reject(new Error(`Could not store the fixture ${item.kind}.`));
        };
      });
      database.close();
    },
    { folderPath, item: fixtureItem },
  );
}
