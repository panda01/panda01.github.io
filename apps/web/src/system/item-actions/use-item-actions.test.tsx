import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addTestFolderAliasToDesktop,
  endTestDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import { finderAppId, getInfoAppId, quickLookAppId } from '../app-registry/app-registry.mts';
import { DesktopSessionProvider } from '../desktop-session/desktop-session-context.tsx';
import type { DesktopSession } from '../desktop-session/desktop-session.mts';
import type { FileSystemItem } from '../fs/file-system.types.mts';
import { useDesktopNoticeStore } from '../notices/desktop-notice-store.mts';
import type { ItemMenuActionId } from './item-menu.mts';
import { useItemActions } from './use-item-actions.mts';
import type { ItemActions } from './use-item-actions.mts';

let desktopSession: DesktopSession;
let itemActions: ItemActions;

/**
 * Wraps the hook under test in the test session's provider.
 * @param props - The hook's rendered children.
 * @param props.children - Children to wrap.
 * @returns The provider element.
 */
function SessionWrapper({ children }: { children: ReactNode }) {
  return (
    <DesktopSessionProvider desktopSession={desktopSession}>{children}</DesktopSessionProvider>
  );
}

beforeEach(async () => {
  desktopSession = await startTestDesktopSession();
  useDesktopNoticeStore.getState().dismissNotice();
  itemActions = renderHook(() => useItemActions(), { wrapper: SessionWrapper }).result.current;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await endTestDesktopSession(desktopSession);
});

/**
 * Reads a seeded item.
 * @param itemPath - The item's path.
 * @returns The item.
 */
function getItem(itemPath: string): Promise<FileSystemItem> {
  return desktopSession.fileSystem.getItem(itemPath);
}

/**
 * Lists the open windows as app id and launch argument pairs.
 * @returns The open windows.
 */
function listOpenWindows() {
  return Object.values(desktopSession.windowManagerStore.getState().windowsById).map(
    ({ appId, launchArgument }) => ({ appId, launchArgument }),
  );
}

/**
 * Reads the notice currently shown on the desktop.
 * @returns The notice text, if any.
 */
function readNotice(): string | undefined {
  return useDesktopNoticeStore.getState().noticeMessage;
}

describe('opening items', () => {
  it('opens folders in a Finder window, or in place when the caller shows folders itself', async () => {
    const documentsFolder = await getItem('/Users/guest/Documents');
    const showFolderInPlace = vi.fn();

    act(() => {
      itemActions.openItem(documentsFolder);
      itemActions.openItem(documentsFolder, { showFolderInPlace });
    });

    expect(listOpenWindows()).toEqual([
      { appId: finderAppId, launchArgument: '/Users/guest/Documents' },
    ]);
    expect(showFolderInPlace).toHaveBeenCalledWith('/Users/guest/Documents');
  });

  it('previews files in Quick Look and opens web links in a new tab at once', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    const aboutMe = await getItem('/Users/guest/Desktop/About Me.txt');
    const gitHubLink = await getItem('/Users/guest/Desktop/GitHub');

    act(() => {
      itemActions.openItem(aboutMe);
      itemActions.openItem(gitHubLink);
    });

    expect(listOpenWindows()).toEqual([
      { appId: quickLookAppId, launchArgument: '/Users/guest/Desktop/About Me.txt' },
    ]);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://github.com/panda01',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('opens an alias’s original, and explains when the original is gone', async () => {
    await addTestFolderAliasToDesktop(desktopSession);
    const workAlias = await getItem('/Users/guest/Desktop/Work');

    act(() => {
      itemActions.openItem(workAlias);
    });
    await waitFor(() => {
      expect(listOpenWindows()).toEqual([
        { appId: finderAppId, launchArgument: '/Users/guest/Work' },
      ]);
    });

    await desktopSession.fileSystem.remove('/Users/guest/Work');
    act(() => {
      itemActions.openItem(workAlias);
    });
    await waitFor(() => {
      expect(readNotice()).toBe(
        'The alias “Work” can’t be opened because the original item can’t be found.',
      );
    });
  });

  it('reports an alias that cannot be looked up', async () => {
    await addTestFolderAliasToDesktop(desktopSession);
    const workAlias = await getItem('/Users/guest/Desktop/Work');
    vi.spyOn(desktopSession.fileSystem, 'findItem').mockRejectedValue(
      new Error('Database closed.'),
    );

    act(() => {
      itemActions.openItem(workAlias);
    });

    await waitFor(() => {
      expect(readNotice()).toBe("Couldn't open “Work”. Database closed.");
    });
  });
});

describe('Quick Look toggling', () => {
  it('opens and closes Quick Look on the same item', () => {
    act(() => {
      itemActions.toggleQuickLook('/Users/guest/Desktop/About Me.txt');
    });
    expect(listOpenWindows()).toHaveLength(1);

    act(() => {
      itemActions.toggleQuickLook('/Users/guest/Desktop/About Me.txt');
    });
    expect(listOpenWindows()).toHaveLength(0);
  });
});

describe('right-click menu actions', () => {
  /**
   * Runs a menu action on a seeded item.
   * @param actionId - The menu entry.
   * @param itemPath - The item's path.
   * @param startRenamingItem - Rename callback, for the Rename entry.
   * @returns Resolves once the action has been started.
   */
  async function runMenuAction(
    actionId: ItemMenuActionId,
    itemPath: string,
    startRenamingItem?: (renamedPath: string) => void,
  ): Promise<void> {
    const targetItem = await getItem(itemPath);
    act(() => {
      itemActions.runItemMenuAction(
        actionId,
        targetItem,
        startRenamingItem === undefined ? {} : { startRenamingItem },
      );
    });
  }

  it('opens, previews, and shows info', async () => {
    await runMenuAction('open', '/Users/guest/Documents');
    await runMenuAction('quick-look', '/Users/guest/Desktop/Resume.pdf');
    await runMenuAction('get-info', '/Users/guest/Desktop/Resume.pdf');

    expect(listOpenWindows()).toEqual([
      { appId: finderAppId, launchArgument: '/Users/guest/Documents' },
      { appId: quickLookAppId, launchArgument: '/Users/guest/Desktop/Resume.pdf' },
      { appId: getInfoAppId, launchArgument: '/Users/guest/Desktop/Resume.pdf' },
    ]);
  });

  it('starts renaming, and does nothing for Rename where renaming is not offered', async () => {
    const startRenamingItem = vi.fn();

    await runMenuAction('rename', '/Users/guest/Desktop/About Me.txt', startRenamingItem);
    await runMenuAction('rename', '/Users/guest/Desktop/About Me.txt');

    expect(startRenamingItem).toHaveBeenCalledOnce();
    expect(startRenamingItem).toHaveBeenCalledWith('/Users/guest/Desktop/About Me.txt');
  });

  it('duplicates, trashes, puts back and deletes items', async () => {
    const { fileSystem } = desktopSession;

    await runMenuAction('duplicate', '/Users/guest/Desktop/About Me.txt');
    await waitFor(async () => {
      expect(await fileSystem.exists('/Users/guest/Desktop/About Me copy.txt')).toBe(true);
    });

    await runMenuAction('move-to-trash', '/Users/guest/Desktop/About Me copy.txt');
    await waitFor(async () => {
      expect(await fileSystem.exists('/Users/guest/.Trash/About Me copy.txt')).toBe(true);
    });

    await runMenuAction('put-back', '/Users/guest/.Trash/About Me copy.txt');
    await waitFor(async () => {
      expect(await fileSystem.exists('/Users/guest/Desktop/About Me copy.txt')).toBe(true);
    });

    await runMenuAction('delete-immediately', '/Users/guest/Desktop/About Me copy.txt');
    await waitFor(async () => {
      expect(await fileSystem.exists('/Users/guest/Desktop/About Me copy.txt')).toBe(false);
    });
  });

  it('downloads files', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(vi.fn());

    await runMenuAction('download', '/Users/guest/Desktop/About Me.txt');

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalledOnce();
    });
  });

  it('reports failures as notices', async () => {
    const aboutMe = await getItem('/Users/guest/Desktop/About Me.txt');
    await desktopSession.fileSystem.remove('/Users/guest/Desktop/About Me.txt');

    for (const actionId of [
      'duplicate',
      'download',
      'move-to-trash',
      'put-back',
      'delete-immediately',
    ] as const) {
      useDesktopNoticeStore.getState().dismissNotice();
      act(() => {
        itemActions.runItemMenuAction(actionId, aboutMe);
      });
      await waitFor(() => {
        expect(readNotice()).toMatch(/^Couldn't .*“About Me\.txt”/);
      });
    }
  });
});

describe('renaming, new folders and the Trash', () => {
  it('renames items and reports clashes', async () => {
    const aboutMe = await getItem('/Users/guest/Desktop/About Me.txt');

    expect((await itemActions.renameItem(aboutMe, 'Hello.txt'))?.name).toBe('Hello.txt');
    const resume = await getItem('/Users/guest/Desktop/Resume.pdf');
    expect(await itemActions.renameItem(resume, 'Hello.txt')).toBeUndefined();
    expect(readNotice()).toMatch(/^Couldn't rename “Resume\.pdf”/);
  });

  it('creates untitled folders and reports failures', async () => {
    expect((await itemActions.createFolderIn('/Users/guest/Documents'))?.name).toBe(
      'untitled folder',
    );
    expect(await itemActions.createFolderIn('/Users/guest/Missing')).toBeUndefined();
    expect(readNotice()).toMatch(/^Couldn't create the folder/);
  });

  it('empties the Trash and reports failures', async () => {
    await desktopSession.fileSystem.moveToTrash('/Users/guest/Desktop/Resume.pdf');

    act(() => {
      itemActions.emptyTrash();
    });
    await waitFor(async () => {
      expect(await desktopSession.fileSystem.listFolder('/Users/guest/.Trash')).toEqual([]);
    });

    vi.spyOn(desktopSession.fileSystem, 'emptyTrash').mockRejectedValue(new Error('Busy.'));
    act(() => {
      itemActions.emptyTrash();
    });
    await waitFor(() => {
      expect(readNotice()).toBe("Couldn't empty the Trash. Busy.");
    });
  });
});
