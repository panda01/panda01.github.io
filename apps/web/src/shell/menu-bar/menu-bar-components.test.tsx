import { act, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aboutThisMacAppId } from '../../system/app-registry/app-registry.mts';
import type { DesktopSession } from '../../system/desktop-session/desktop-session.mts';
import { useDesktopNoticeStore } from '../../system/notices/desktop-notice-store.mts';
import {
  endTestDesktopSession,
  renderInDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import type { FullScreenControls } from '../keyboard/use-full-screen-state.mts';
import { MenuBar } from './MenuBar.tsx';
import { MenuBarClock } from './MenuBarClock.tsx';

describe('MenuBarClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the current time and keeps it up to date', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 11, 9, 41, 30) });
    render(<MenuBarClock />);
    expect(screen.getByText('Sun Oct 11 9:41 AM')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText('Sun Oct 11 9:42 AM')).toBeInTheDocument();
  });
});

describe('MenuBar', () => {
  let desktopSession: DesktopSession;
  let fullScreenControls: FullScreenControls;
  let onRequestDesktopReset: () => void;

  beforeEach(async () => {
    desktopSession = await startTestDesktopSession();
    fullScreenControls = {
      isFullScreen: false,
      isKeyboardLocked: false,
      enterFullScreen: vi.fn(),
      exitFullScreen: vi.fn(),
    };
    onRequestDesktopReset = vi.fn();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    useDesktopNoticeStore.getState().dismissNotice();
    await endTestDesktopSession(desktopSession);
  });

  /**
   * Renders the menu bar in the test session.
   * @param controls - Full-screen controls to use.
   */
  function renderMenuBar(controls: FullScreenControls = fullScreenControls): void {
    renderInDesktopSession(
      <MenuBar fullScreenControls={controls} onRequestDesktopReset={onRequestDesktopReset} />,
      desktopSession,
    );
  }

  /**
   * Opens a menu bar menu and chooses one of its items.
   * @param menuButtonName - Accessible name of the menu bar button.
   * @param menuItemName - Name of the item to choose.
   */
  async function chooseMenuItem(menuButtonName: string, menuItemName: string): Promise<void> {
    const menuBar = screen.getByRole('navigation', { name: 'Menu bar' });
    await userEvent.click(within(menuBar).getByRole('button', { name: menuButtonName }));
    await userEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${menuItemName}`) }));
  }

  /**
   * Opens About This Mac directly through the window manager.
   * @returns The window id.
   */
  function openAboutWindow(): string {
    let aboutWindowId = '';
    act(() => {
      aboutWindowId = desktopSession.windowManagerStore.getState().openWindow({
        appId: aboutThisMacAppId,
        title: 'About This Mac',
        defaultSize: { width: 440, height: 320 },
        allowsMultipleWindows: false,
      });
    });
    return aboutWindowId;
  }

  it('names the focused app, or Finder when no window is focused', () => {
    renderMenuBar();
    const menuBar = screen.getByRole('navigation', { name: 'Menu bar' });
    expect(within(menuBar).getByRole('button', { name: 'Finder' })).toBeInTheDocument();

    openAboutWindow();

    expect(within(menuBar).getByRole('button', { name: 'About This Mac' })).toBeInTheDocument();
  });

  it('opens About This Mac and asks to reset from the system menu', async () => {
    renderMenuBar();

    await chooseMenuItem('System menu', 'About This Mac');
    expect(Object.values(desktopSession.windowManagerStore.getState().windowsById)).toHaveLength(1);

    await chooseMenuItem('System menu', 'Reset Desktop');
    expect(onRequestDesktopReset).toHaveBeenCalledOnce();
  });

  it('enters and exits full-screen from the system menu', async () => {
    renderMenuBar();
    await chooseMenuItem('System menu', 'Enter Full Screen');
    expect(fullScreenControls.enterFullScreen).toHaveBeenCalledOnce();
  });

  it('offers Exit Full Screen while full-screen', async () => {
    renderMenuBar({ ...fullScreenControls, isFullScreen: true });
    await chooseMenuItem('System menu', 'Exit Full Screen');
    expect(fullScreenControls.exitFullScreen).toHaveBeenCalledOnce();
  });

  it('creates a new folder on the desktop from the File menu', async () => {
    renderMenuBar();

    await chooseMenuItem('File', 'New Folder');

    await vi.waitFor(async () => {
      expect(await desktopSession.fileSystem.exists('/Users/guest/Desktop/untitled folder')).toBe(
        true,
      );
    });
  });

  it('shows a notice when the folder cannot be created', async () => {
    vi.spyOn(desktopSession.fileSystem, 'createFolder').mockRejectedValue(new Error('Disk full.'));
    renderMenuBar();

    await chooseMenuItem('File', 'New Folder');

    await vi.waitFor(() => {
      expect(useDesktopNoticeStore.getState().noticeMessage).toBe(
        "Couldn't create the folder. Disk full.",
      );
    });
  });

  it('minimizes, zooms, closes and quits the focused window from the menus', async () => {
    renderMenuBar();
    const aboutWindowId = openAboutWindow();
    /**
     * Reads the About window from the window manager.
     * @returns The window state.
     */
    const readAboutWindow = () =>
      desktopSession.windowManagerStore.getState().windowsById[aboutWindowId];

    await chooseMenuItem('Window', 'Zoom');
    expect(readAboutWindow()?.isZoomed).toBe(true);
    await chooseMenuItem('Window', 'Minimize');
    expect(readAboutWindow()?.isMinimized).toBe(true);

    act(() => {
      desktopSession.windowManagerStore.getState().restoreWindow(aboutWindowId);
    });
    await chooseMenuItem('File', 'Close Window');
    expect(readAboutWindow()).toBeUndefined();

    openAboutWindow();
    await chooseMenuItem('About This Mac', 'Quit About This Mac');
    expect(desktopSession.windowManagerStore.getState().windowStackOrder).toEqual([]);
  });

  it('closes an open menu with Escape', async () => {
    renderMenuBar();
    await userEvent.click(screen.getByRole('button', { name: 'File' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    await vi.waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });
});
