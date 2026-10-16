import { act, fireEvent, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppManifest } from '../../system/app-registry/app-manifest.types.mts';
import {
  buildOpenWindowRequest,
  findAppManifest,
  finderAppId,
  getInfoAppId,
  quickLookAppId,
} from '../../system/app-registry/app-registry.mts';
import type { DesktopSession } from '../../system/desktop-session/desktop-session.mts';
import { useDesktopNoticeStore } from '../../system/notices/desktop-notice-store.mts';
import {
  addTestFolderAliasToDesktop,
  addTestSubfoldersToDocuments,
  endTestDesktopSession,
  renderInDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import { Finder } from './Finder.tsx';
import { toggleSortOrder } from './FinderListView.tsx';

let desktopSession: DesktopSession;

beforeEach(async () => {
  desktopSession = await startTestDesktopSession();
});

afterEach(async () => {
  vi.restoreAllMocks();
  useDesktopNoticeStore.getState().dismissNotice();
  await endTestDesktopSession(desktopSession);
});

/**
 * Looks up Finder's manifest.
 * @returns The manifest.
 */
function requireFinderManifest(): AppManifest {
  const finderManifest = findAppManifest(finderAppId);
  if (finderManifest === undefined) {
    throw new Error('Finder is not registered.');
  }
  return finderManifest;
}

/**
 * Opens a Finder window in the window manager and renders its content.
 * @param folderPath - The folder to open, or undefined for the home folder.
 * @returns The window's id.
 */
function renderFinder(folderPath?: string): string {
  let windowId = '';
  act(() => {
    windowId = desktopSession.windowManagerStore
      .getState()
      .openWindow(buildOpenWindowRequest(requireFinderManifest(), folderPath));
  });
  renderInDesktopSession(
    <Finder
      windowId={windowId}
      {...(folderPath === undefined ? {} : { launchArgument: folderPath })}
    />,
    desktopSession,
  );
  return windowId;
}

/**
 * Returns the icon view's list of items.
 * @returns The list.
 */
function getFolderContents(): HTMLElement {
  return screen.getByRole('list', { name: 'Folder contents' });
}

/**
 * Waits for an item in the icon view.
 * @param itemName - The item's name.
 * @returns The item's button.
 */
function findFolderItem(itemName: string): Promise<HTMLElement> {
  return within(getFolderContents()).findByRole('button', { name: itemName });
}

/**
 * Reads a window from the window manager.
 * @param windowId - The window.
 * @returns Its state.
 */
function readWindow(windowId: string) {
  return desktopSession.windowManagerStore.getState().windowsById[windowId];
}

/**
 * Lists the open windows of an app by launch argument.
 * @param appId - The app.
 * @returns The launch arguments of its windows.
 */
function listLaunchArgumentsOf(appId: string): (string | undefined)[] {
  return Object.values(desktopSession.windowManagerStore.getState().windowsById)
    .filter((openWindow) => openWindow.appId === appId)
    .map((openWindow) => openWindow.launchArgument);
}

/**
 * Right-clicks an element and chooses a menu entry.
 * @param menuOwner - The element to right-click.
 * @param menuItemName - The entry to choose.
 */
async function chooseFromMenu(menuOwner: HTMLElement, menuItemName: string): Promise<void> {
  fireEvent.contextMenu(menuOwner);
  await userEvent.click(await screen.findByRole('menuitem', { name: menuItemName }));
}

/**
 * Clicks a sidebar location.
 * @param locationName - The location.
 */
async function clickSidebarLocation(locationName: string): Promise<void> {
  await userEvent.click(
    within(screen.getByRole('navigation', { name: 'Sidebar' })).getByRole('button', {
      name: locationName,
    }),
  );
}

describe('Finder navigation', () => {
  it('opens on the home folder, follows the sidebar, path bar and history, and keeps the title current', async () => {
    await addTestSubfoldersToDocuments(desktopSession);
    const windowId = renderFinder();
    expect(await findFolderItem('Documents')).toBeInTheDocument();
    expect(readWindow(windowId)).toMatchObject({ title: 'guest', launchArgument: '/Users/guest' });
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();

    await clickSidebarLocation('Documents');
    await userEvent.dblClick(await findFolderItem('Drafts'));
    expect(await findFolderItem('README.txt')).toBeInTheDocument();
    expect(readWindow(windowId)).toMatchObject({
      title: 'Drafts',
      launchArgument: '/Users/guest/Documents/Drafts',
    });
    const pathBar = screen.getByRole('navigation', { name: 'Path' });
    expect(
      within(pathBar)
        .getAllByRole('button')
        .map((pathButton) => pathButton.textContent),
    ).toEqual(['Macintosh HD', 'Users', 'guest', 'Documents', 'Drafts']);
    expect(screen.getByText('1 item')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await findFolderItem('Archive')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(await findFolderItem('README.txt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forward' })).toBeDisabled();

    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Path' })).getByRole('button', {
        name: 'Macintosh HD',
      }),
    );
    expect(await findFolderItem('Users')).toBeInTheDocument();
    expect(readWindow(windowId)?.title).toBe('Macintosh HD');
  });

  it('opens folders in place, files in Quick Look and links in a new tab, from the keyboard too', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    await addTestFolderAliasToDesktop(desktopSession);
    const windowId = renderFinder('/Users/guest/Desktop');

    await userEvent.click(await findFolderItem('About Me.txt'));
    await userEvent.keyboard(' ');
    expect(listLaunchArgumentsOf(quickLookAppId)).toEqual(['/Users/guest/Desktop/About Me.txt']);

    await userEvent.keyboard('{ArrowRight}');
    expect(await findFolderItem('Cover Letter.pdf')).toHaveFocus();
    expect(listLaunchArgumentsOf(quickLookAppId)).toEqual([
      '/Users/guest/Desktop/Cover Letter.pdf',
    ]);
    await userEvent.keyboard('{ArrowRight}');
    expect(await findFolderItem('Email')).toHaveFocus();
    expect(listLaunchArgumentsOf(quickLookAppId)).toEqual(['/Users/guest/Desktop/Email']);
    await userEvent.keyboard('{Enter}');
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'mailto:hello@example.com',
      '_blank',
      'noopener,noreferrer',
    );

    await userEvent.click(getFolderContents());
    await userEvent.dblClick(await findFolderItem('Work'));
    await vi.waitFor(() => {
      expect(readWindow(windowId)).toMatchObject({
        title: 'Work',
        launchArgument: '/Users/guest/Work',
      });
    });
  });

  it('says when the folder it shows no longer exists', async () => {
    renderFinder('/Users/guest/Documents');
    expect(await screen.findByText('0 items')).toBeInTheDocument();

    await act(async () => {
      await desktopSession.fileSystem.remove('/Users/guest/Documents');
    });

    expect(await screen.findByText('This folder is no longer available.')).toBeInTheDocument();
  });
});

describe('Finder views', () => {
  /**
   * Lists the names in list view, top to bottom.
   * @returns The names.
   */
  function listRowNames(): (string | null | undefined)[] {
    const contentsTable = screen.getByRole('table', { name: 'Folder contents' });
    // The name is the text beside the icon (the icon's own label, such as "TXT", is left out).
    return within(contentsTable)
      .getAllByRole('row')
      .slice(1)
      .map(
        (tableRow) => within(tableRow).getAllByRole('cell')[0]?.querySelector('span')?.textContent,
      );
  }

  it('shows a folder as a list that sorts by any column', async () => {
    renderFinder('/Users/guest/Desktop');
    await findFolderItem('About Me.txt');

    await userEvent.click(screen.getByRole('button', { name: 'as List' }));
    expect(listRowNames()).toEqual([
      'About Me.txt',
      'Cover Letter.pdf',
      'Email',
      'GitHub',
      'LinkedIn',
      'Musings',
      'Resume.pdf',
    ]);
    const contentsTable = screen.getByRole('table', { name: 'Folder contents' });
    expect(within(contentsTable).getByRole('row', { name: /^About Me\.txt/ })).toHaveTextContent(
      'Plain Text Document',
    );
    expect(within(contentsTable).getByRole('row', { name: /^GitHub/ })).toHaveTextContent('--');

    await userEvent.click(within(contentsTable).getByRole('button', { name: 'Name' }));
    expect(listRowNames()[0]).toBe('Resume.pdf');
    await userEvent.click(within(contentsTable).getByRole('button', { name: 'Size' }));
    expect(listRowNames().slice(0, 4)).toEqual(['Email', 'GitHub', 'LinkedIn', 'Musings']);
  });

  it('flips the sort direction when the same heading is clicked again', () => {
    expect(toggleSortOrder({ column: 'name', direction: 'ascending' }, 'name')).toEqual({
      column: 'name',
      direction: 'descending',
    });
    expect(toggleSortOrder({ column: 'name', direction: 'descending' }, 'name').direction).toBe(
      'ascending',
    );
    expect(toggleSortOrder({ column: 'name', direction: 'descending' }, 'kind')).toEqual({
      column: 'kind',
      direction: 'ascending',
    });
  });

  it('renames an item inside list view', async () => {
    renderFinder('/Users/guest/Desktop');
    await findFolderItem('About Me.txt');
    await userEvent.click(screen.getByRole('button', { name: 'as List' }));

    await chooseFromMenu(screen.getByRole('row', { name: /^About Me\.txt/ }), 'Rename');
    const nameField = await screen.findByRole('textbox', { name: 'Name' });
    await userEvent.clear(nameField);
    await userEvent.type(nameField, 'Intro.txt{Enter}');

    expect(await screen.findByRole('row', { name: /^Intro\.txt/ })).toBeInTheDocument();
  });

  it('shows folders as columns, previews the selected file, and creates folders in a column', async () => {
    await desktopSession.fileSystem.createFolder('/Users/guest/Desktop/Sub');
    await addTestSubfoldersToDocuments(desktopSession);
    const windowId = renderFinder('/Users/guest/Desktop/Sub');
    await userEvent.click(screen.getByRole('button', { name: 'as Columns' }));
    expect(await screen.findByRole('list', { name: 'guest' })).toBeInTheDocument();

    const desktopColumn = screen.getByRole('list', { name: 'Desktop' });
    await userEvent.click(
      await within(desktopColumn).findByRole('button', { name: 'About Me.txt' }),
    );
    expect(readWindow(windowId)?.launchArgument).toBe('/Users/guest/Desktop');
    expect(await screen.findByText(/^Plain Text Document – \d+ bytes$/)).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('list', { name: 'guest' })).getByRole('button', {
        name: 'Documents',
      }),
    );
    const documentsColumn = await screen.findByRole('list', { name: 'Documents' });
    expect(
      await within(documentsColumn).findByRole('button', { name: 'Drafts' }),
    ).toBeInTheDocument();
    expect(readWindow(windowId)?.title).toBe('Documents');

    await chooseFromMenu(documentsColumn, 'New Folder');
    const nameField = await screen.findByRole('textbox', { name: 'Name' });
    await userEvent.clear(nameField);
    await userEvent.type(nameField, 'Column Folder{Enter}');
    expect(
      await within(screen.getByRole('list', { name: 'Documents' })).findByRole('button', {
        name: 'Column Folder',
      }),
    ).toBeInTheDocument();
  });

  it('searches the folder and its subfolders, and clears the search when moving elsewhere', async () => {
    await addTestSubfoldersToDocuments(desktopSession);
    renderFinder('/Users/guest/Documents');
    await findFolderItem('Drafts');
    await userEvent.click(screen.getByRole('button', { name: 'as Columns' }));

    const searchField = screen.getByRole('searchbox', { name: 'Search' });
    await userEvent.type(searchField, 'readme');
    const resultsTable = await screen.findByRole('table', { name: 'Folder contents' });
    await vi.waitFor(() => {
      expect(within(resultsTable).getAllByRole('row')).toHaveLength(3);
    });

    await userEvent.clear(searchField);
    await userEvent.type(searchField, 'zzz');
    expect(await screen.findByText('No results')).toBeInTheDocument();

    await clickSidebarLocation('Desktop');
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
  });
});

describe('Finder file management', () => {
  it('names a new folder inline, renames items, and keeps names on cancel or clash', async () => {
    renderFinder('/Users/guest/Documents');
    await screen.findByText('0 items');

    await chooseFromMenu(getFolderContents(), 'New Folder');
    const nameField = await screen.findByRole('textbox', { name: 'Name' });
    expect(nameField).toHaveFocus();
    expect(nameField).toHaveValue('untitled folder');
    await userEvent.clear(nameField);
    await userEvent.type(nameField, 'Notes{Enter}');
    expect(await findFolderItem('Notes')).toBeInTheDocument();

    await chooseFromMenu(await findFolderItem('Notes'), 'Rename');
    await userEvent.keyboard('{Escape}');
    expect(await findFolderItem('Notes')).toBeInTheDocument();

    await desktopSession.fileSystem.createFolder('/Users/guest/Documents/Taken');
    await chooseFromMenu(await findFolderItem('Notes'), 'Rename');
    const renameField = await screen.findByRole('textbox', { name: 'Name' });
    await userEvent.clear(renameField);
    await userEvent.type(renameField, 'Taken{Enter}');
    await vi.waitFor(() => {
      expect(useDesktopNoticeStore.getState().noticeMessage).toMatch(/^Couldn't rename “Notes”/);
    });
    expect(await findFolderItem('Notes')).toBeInTheDocument();
  });

  it('duplicates an item, shows its info, and moves it to the Trash', async () => {
    renderFinder('/Users/guest/Desktop');

    await chooseFromMenu(await findFolderItem('About Me.txt'), 'Duplicate');
    await chooseFromMenu(await findFolderItem('About Me copy.txt'), 'Get Info');
    expect(listLaunchArgumentsOf(getInfoAppId)).toEqual(['/Users/guest/Desktop/About Me copy.txt']);
    await chooseFromMenu(await findFolderItem('About Me copy.txt'), 'Move to Trash');

    await vi.waitFor(() => {
      expect(
        within(getFolderContents()).queryByRole('button', { name: 'About Me copy.txt' }),
      ).toBeNull();
    });
    await clickSidebarLocation('Trash');
    expect(await findFolderItem('About Me copy.txt')).toBeInTheDocument();
  });

  it('puts items in the Trash back, or deletes them immediately', async () => {
    const { fileSystem } = desktopSession;
    await fileSystem.moveToTrash('/Users/guest/Desktop/About Me.txt');
    await fileSystem.moveToTrash('/Users/guest/Desktop/Resume.pdf');
    renderFinder('/Users/guest/.Trash');

    await chooseFromMenu(await findFolderItem('About Me.txt'), 'Put Back');
    await chooseFromMenu(await findFolderItem('Resume.pdf'), 'Delete Immediately');

    await vi.waitFor(async () => {
      expect(await fileSystem.exists('/Users/guest/Desktop/About Me.txt')).toBe(true);
      expect(await fileSystem.exists('/Users/guest/.Trash/Resume.pdf')).toBe(false);
    });
  });

  it('empties the Trash from its menu or its Empty button', async () => {
    const { fileSystem } = desktopSession;
    await fileSystem.moveToTrash('/Users/guest/Desktop/LinkedIn');
    renderFinder('/Users/guest/.Trash');

    await findFolderItem('LinkedIn');
    await chooseFromMenu(getFolderContents(), 'Empty Trash');
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Empty' })).toBeDisabled();
    });

    await act(async () => {
      await fileSystem.moveToTrash('/Users/guest/Desktop/GitHub');
    });
    const emptyButton = screen.getByRole('button', { name: 'Empty' });
    await vi.waitFor(() => {
      expect(emptyButton).toBeEnabled();
    });
    await userEvent.click(emptyButton);
    await vi.waitFor(async () => {
      expect(await fileSystem.listFolder('/Users/guest/.Trash')).toEqual([]);
    });
  });
});
