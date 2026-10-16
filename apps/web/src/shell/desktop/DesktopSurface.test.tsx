import { fireEvent, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopSession } from '../../system/desktop-session/desktop-session.mts';
import { useDesktopNoticeStore } from '../../system/notices/desktop-notice-store.mts';
import {
  addTestFolderAliasToDesktop,
  endTestDesktopSession,
  renderInDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import { DesktopSurface } from './DesktopSurface.tsx';

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
 * Renders the desktop surface and waits for the seeded icons.
 * @returns The list of desktop items.
 */
async function renderDesktopSurface(): Promise<HTMLElement> {
  renderInDesktopSession(<DesktopSurface />, desktopSession);
  const desktopItemList = screen.getByRole('list', { name: 'Desktop items' });
  await within(desktopItemList).findByRole('button', { name: 'About Me.txt' });
  return desktopItemList;
}

/**
 * Lists the open windows as app id and launch argument pairs.
 * @returns The open windows, oldest first.
 */
function listOpenWindows() {
  return Object.values(desktopSession.windowManagerStore.getState().windowsById).map(
    ({ appId, launchArgument }) => ({ appId, launchArgument }),
  );
}

/**
 * Right-clicks a desktop icon and chooses a menu item.
 * @param desktopItemList - The list of desktop items.
 * @param itemName - The icon's name.
 * @param menuItemName - The menu item to choose.
 */
async function chooseIconMenuItem(
  desktopItemList: HTMLElement,
  itemName: string,
  menuItemName: string,
): Promise<void> {
  fireEvent.contextMenu(within(desktopItemList).getByRole('button', { name: itemName }));
  await userEvent.click(await screen.findByRole('menuitem', { name: menuItemName }));
}

describe('DesktopSurface', () => {
  it('shows every item in the Desktop folder', async () => {
    const desktopItemList = await renderDesktopSurface();

    expect(
      within(desktopItemList)
        .getAllByRole('button')
        .map((iconButton) => iconButton.getAttribute('aria-label')),
    ).toEqual([
      'About Me.txt',
      'Cover Letter.pdf',
      'Email',
      'GitHub',
      'LinkedIn',
      'Musings',
      'Resume.pdf',
    ]);
  });

  it('creates a new folder from the empty-space menu', async () => {
    const desktopItemList = await renderDesktopSurface();

    fireEvent.contextMenu(screen.getByTestId('desktop-surface'));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'New Folder' }));

    expect(
      await within(desktopItemList).findByRole('button', { name: 'untitled folder' }),
    ).toBeInTheDocument();
  });

  it('opens Get Info and moves items to the Trash from an icon’s menu', async () => {
    const desktopItemList = await renderDesktopSurface();

    await chooseIconMenuItem(desktopItemList, 'Resume.pdf', 'Get Info');
    expect(Object.values(desktopSession.windowManagerStore.getState().windowsById)).toEqual([
      expect.objectContaining({
        title: 'Resume.pdf Info',
        launchArgument: '/Users/guest/Desktop/Resume.pdf',
      }),
    ]);

    await chooseIconMenuItem(desktopItemList, 'Resume.pdf', 'Move to Trash');
    await vi.waitFor(() => {
      expect(within(desktopItemList).queryByRole('button', { name: 'Resume.pdf' })).toBeNull();
    });
  });

  it('opens web links by menu, double-click, or Enter, and selects icons on click', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const desktopItemList = await renderDesktopSurface();
    const gitHubIcon = within(desktopItemList).getByRole('button', { name: 'GitHub' });

    await chooseIconMenuItem(desktopItemList, 'GitHub', 'Open');
    await userEvent.dblClick(gitHubIcon);
    gitHubIcon.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{a}');

    expect(windowOpenSpy).toHaveBeenCalledTimes(3);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://github.com/panda01',
      '_blank',
      'noopener,noreferrer',
    );

    await userEvent.click(gitHubIcon);
    await userEvent.click(screen.getByTestId('desktop-surface'));
  });

  it('opens files in Quick Look and folders (through aliases too) in Finder', async () => {
    await addTestFolderAliasToDesktop(desktopSession);
    const desktopItemList = await renderDesktopSurface();

    await chooseIconMenuItem(desktopItemList, 'About Me.txt', 'Open');
    await userEvent.dblClick(within(desktopItemList).getByRole('button', { name: 'Work' }));

    // Clicking the Work alias (the first half of the double-click) moves the open Quick Look to it.
    await vi.waitFor(() => {
      expect(listOpenWindows()).toEqual([
        { appId: 'quick-look', launchArgument: '/Users/guest/Desktop/Work' },
        { appId: 'finder', launchArgument: '/Users/guest/Work' },
      ]);
    });
  });

  it('toggles Quick Look with Space and follows the selection with the arrow keys', async () => {
    const desktopItemList = await renderDesktopSurface();
    const aboutMeIcon = within(desktopItemList).getByRole('button', { name: 'About Me.txt' });

    await userEvent.click(aboutMeIcon);
    expect(aboutMeIcon).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(listOpenWindows()).toEqual([
      { appId: 'quick-look', launchArgument: '/Users/guest/Desktop/About Me.txt' },
    ]);

    await userEvent.keyboard('{ArrowDown}');
    expect(within(desktopItemList).getByRole('button', { name: 'Cover Letter.pdf' })).toHaveFocus();
    expect(listOpenWindows()).toEqual([
      { appId: 'quick-look', launchArgument: '/Users/guest/Desktop/Cover Letter.pdf' },
    ]);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(aboutMeIcon).toHaveFocus();

    await userEvent.keyboard(' ');
    expect(listOpenWindows()).toEqual([]);
  });

  it('renames an icon in place, keeping the old name on Escape or when left empty', async () => {
    const desktopItemList = await renderDesktopSurface();

    await chooseIconMenuItem(desktopItemList, 'About Me.txt', 'Rename');
    const nameField = await screen.findByRole('textbox', { name: 'Name' });
    expect(nameField).toHaveFocus();
    expect(nameField).toHaveValue('About Me.txt');
    expect([
      (nameField as HTMLInputElement).selectionStart,
      (nameField as HTMLInputElement).selectionEnd,
    ]).toEqual([0, 8]);
    await userEvent.keyboard('{Escape}');
    expect(within(desktopItemList).getByRole('button', { name: 'About Me.txt' })).toBeVisible();

    await chooseIconMenuItem(desktopItemList, 'About Me.txt', 'Rename');
    await userEvent.clear(await screen.findByRole('textbox', { name: 'Name' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Hello.txt{Enter}');

    expect(
      await within(desktopItemList).findByRole('button', { name: 'Hello.txt' }),
    ).toBeInTheDocument();
  });

  it('reports failures to create folders or trash items', async () => {
    const desktopItemList = await renderDesktopSurface();
    vi.spyOn(desktopSession.fileSystem, 'createFolder').mockRejectedValue(new Error('Read-only.'));
    vi.spyOn(desktopSession.fileSystem, 'moveToTrash').mockRejectedValue(new Error('Locked.'));

    fireEvent.contextMenu(screen.getByTestId('desktop-surface'));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'New Folder' }));
    await vi.waitFor(() => {
      expect(useDesktopNoticeStore.getState().noticeMessage).toBe(
        "Couldn't create the folder. Read-only.",
      );
    });

    await chooseIconMenuItem(desktopItemList, 'Email', 'Move to Trash');
    await vi.waitFor(() => {
      expect(useDesktopNoticeStore.getState().noticeMessage).toBe(
        "Couldn't move “Email” to the Trash. Locked.",
      );
    });
  });
});
