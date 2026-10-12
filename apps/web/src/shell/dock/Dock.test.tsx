import { act, fireEvent, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getInfoAppId } from '../../system/app-registry/app-registry.mts';
import type { DesktopSession } from '../../system/desktop-session/desktop-session.mts';
import { useDesktopNoticeStore } from '../../system/notices/desktop-notice-store.mts';
import {
  endTestDesktopSession,
  renderInDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import { Dock } from './Dock.tsx';

let desktopSession: DesktopSession;

beforeEach(async () => {
  desktopSession = await startTestDesktopSession();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  useDesktopNoticeStore.getState().dismissNotice();
  await endTestDesktopSession(desktopSession);
});

/**
 * Returns the Dock toolbar.
 * @returns The Dock element.
 */
function getDock(): HTMLElement {
  return screen.getByRole('toolbar', { name: 'Dock' });
}

/**
 * Right-clicks a Dock item and chooses a menu item.
 * @param dockItemName - Accessible name of the Dock item.
 * @param menuItemName - Name of the menu item to choose.
 */
async function chooseDockMenuItem(dockItemName: string, menuItemName: string): Promise<void> {
  fireEvent.contextMenu(within(getDock()).getByRole('button', { name: dockItemName }));
  const dockMenuItem = await screen.findByRole('menuitem', { name: menuItemName });
  // The Trash's item count updates asynchronously, so wait until the item is available.
  await vi.waitFor(() => {
    expect(dockMenuItem).not.toHaveAttribute('aria-disabled', 'true');
  });
  await userEvent.click(dockMenuItem);
}

describe('Dock', () => {
  it('launches an app with a bounce and shows it as running', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderInDesktopSession(<Dock />, desktopSession);
    const aboutDockItem = within(getDock()).getByRole('button', { name: 'About This Mac' });
    expect(aboutDockItem).toHaveAttribute('data-running', 'false');

    await userEvent.click(aboutDockItem);

    expect(aboutDockItem).toHaveAttribute('data-running', 'true');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await userEvent.click(aboutDockItem);
    expect(desktopSession.windowManagerStore.getState().windowStackOrder).toHaveLength(1);
  });

  it('opens and quits apps from their right-click menu', async () => {
    renderInDesktopSession(<Dock />, desktopSession);

    await chooseDockMenuItem('About This Mac', 'Open');
    expect(desktopSession.windowManagerStore.getState().windowStackOrder).toHaveLength(1);

    await chooseDockMenuItem('About This Mac', 'Quit');
    expect(desktopSession.windowManagerStore.getState().windowStackOrder).toHaveLength(0);
  });

  it('shows minimized windows, which can be restored or closed', async () => {
    renderInDesktopSession(<Dock />, desktopSession);
    /**
     * Opens and minimizes a Get Info window.
     * @param itemPath - The item the window describes.
     * @returns The window id.
     */
    const openMinimizedInfoWindow = (itemPath: string): string => {
      let windowId = '';
      act(() => {
        windowId = desktopSession.windowManagerStore.getState().openWindow({
          appId: getInfoAppId,
          title: `${itemPath} Info`,
          defaultSize: { width: 300, height: 400 },
          launchArgument: itemPath,
          allowsMultipleWindows: true,
        });
        desktopSession.windowManagerStore.getState().minimizeWindow(windowId);
      });
      return windowId;
    };
    const firstWindowId = openMinimizedInfoWindow('/a');
    const secondWindowId = openMinimizedInfoWindow('/b');

    await userEvent.click(within(getDock()).getByRole('button', { name: '/a Info (minimized)' }));
    expect(
      desktopSession.windowManagerStore.getState().windowsById[firstWindowId]?.isMinimized,
    ).toBe(false);

    await chooseDockMenuItem('/b Info (minimized)', 'Show');
    expect(
      desktopSession.windowManagerStore.getState().windowsById[secondWindowId]?.isMinimized,
    ).toBe(false);

    act(() => {
      desktopSession.windowManagerStore.getState().minimizeWindow(secondWindowId);
    });
    await chooseDockMenuItem('/b Info (minimized)', 'Close');
    expect(
      desktopSession.windowManagerStore.getState().windowsById[secondWindowId],
    ).toBeUndefined();
  });

  it('empties the Trash once it has items, and reports failures', async () => {
    renderInDesktopSession(<Dock />, desktopSession);
    fireEvent.contextMenu(within(getDock()).getByRole('button', { name: 'Trash' }));
    expect(await screen.findByRole('menuitem', { name: 'Empty Trash' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });

    await act(async () => {
      await desktopSession.fileSystem.moveToTrash('/Users/guest/Desktop/About Me.txt');
    });
    await chooseDockMenuItem('Trash', 'Empty Trash');
    await vi.waitFor(async () => {
      expect(await desktopSession.fileSystem.listFolder('/Users/guest/.Trash')).toEqual([]);
    });

    await act(async () => {
      await desktopSession.fileSystem.moveToTrash('/Users/guest/Desktop/Resume.pdf');
    });
    vi.spyOn(desktopSession.fileSystem, 'emptyTrash').mockRejectedValue(new Error('Locked.'));
    await chooseDockMenuItem('Trash', 'Empty Trash');
    await vi.waitFor(() => {
      expect(useDesktopNoticeStore.getState().noticeMessage).toBe(
        "Couldn't empty the Trash. Locked.",
      );
    });
  });

  it('clicking the Trash does nothing until Finder exists', async () => {
    renderInDesktopSession(<Dock />, desktopSession);

    await userEvent.click(within(getDock()).getByRole('button', { name: 'Trash' }));

    expect(desktopSession.windowManagerStore.getState().windowStackOrder).toEqual([]);
  });

  it('moves keyboard focus with the arrow keys and ignores other keys', async () => {
    renderInDesktopSession(<Dock />, desktopSession);
    const [aboutDockItem, trashDockItem] = within(getDock()).getAllByRole('button');
    aboutDockItem?.focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(trashDockItem).toHaveFocus();
    expect(trashDockItem).toHaveAttribute('tabindex', '0');
    await userEvent.keyboard('{a}');
    expect(trashDockItem).toHaveFocus();
  });

  it('magnifies icons near the pointer and settles when the pointer leaves', () => {
    renderInDesktopSession(<Dock />, desktopSession);

    fireEvent.mouseMove(getDock(), { clientX: 10 });
    fireEvent.mouseLeave(getDock());

    expect(within(getDock()).getAllByRole('button')).toHaveLength(2);
  });
});
