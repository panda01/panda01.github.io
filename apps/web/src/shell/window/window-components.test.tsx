import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aboutThisMacAppId,
  findAppManifest,
  getInfoAppId,
} from '../../system/app-registry/app-registry.mts';
import type { DesktopSession } from '../../system/desktop-session/desktop-session.mts';
import {
  endTestDesktopSession,
  renderInDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import { DesktopWindow } from './DesktopWindow.tsx';
import { TrafficLights } from './TrafficLights.tsx';
import { WindowErrorBoundary } from './WindowErrorBoundary.tsx';
import { WindowLayer } from './WindowLayer.tsx';

let desktopSession: DesktopSession;

beforeEach(async () => {
  desktopSession = await startTestDesktopSession();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await endTestDesktopSession(desktopSession);
});

/**
 * Opens a window through the window manager.
 * @param appId - The app to open.
 * @param launchArgument - Optional launch argument.
 * @returns The window id.
 */
function openWindowFor(appId: string, launchArgument?: string): string {
  return desktopSession.windowManagerStore.getState().openWindow({
    appId,
    title: launchArgument === undefined ? 'About This Mac' : `${launchArgument} Info`,
    defaultSize: { width: 400, height: 300 },
    allowsMultipleWindows: launchArgument !== undefined,
    ...(launchArgument === undefined ? {} : { launchArgument }),
  });
}

describe('TrafficLights', () => {
  it('runs close, minimize and zoom without triggering the title bar', async () => {
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onTitleBarDoubleClick = vi.fn();
    render(
      <div onDoubleClick={onTitleBarDoubleClick}>
        <TrafficLights
          isWindowFocused={false}
          onClose={onClose}
          onMinimize={onMinimize}
          onZoom={onZoom}
        />
      </div>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    await userEvent.dblClick(screen.getByRole('button', { name: 'Zoom' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onMinimize).toHaveBeenCalledOnce();
    expect(onZoom).toHaveBeenCalledTimes(2);
    expect(onTitleBarDoubleClick).not.toHaveBeenCalled();
  });
});

describe('WindowErrorBoundary', () => {
  it('shows a "quit unexpectedly" message and can reopen or close the window', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldCrash = true;
    /**
     * A window content component that crashes until told not to.
     * @returns Content text.
     */
    function SometimesCrashingContent() {
      if (shouldCrash) {
        throw new Error('Out of cheese.');
      }
      return <p>Working again</p>;
    }
    const onCloseWindow = vi.fn();
    render(
      <WindowErrorBoundary appName="Notes" onCloseWindow={onCloseWindow}>
        <SometimesCrashingContent />
      </WindowErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Notes quit unexpectedly.');
    expect(screen.getByText('Out of cheese.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCloseWindow).toHaveBeenCalledOnce();

    shouldCrash = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(screen.getByText('Working again')).toBeInTheDocument();
  });
});

describe('WindowLayer and DesktopWindow', () => {
  it('shows open windows with their app content, focused on top', async () => {
    renderInDesktopSession(<WindowLayer />, desktopSession);

    act(() => {
      openWindowFor(aboutThisMacAppId);
    });

    const aboutWindow = await screen.findByRole('dialog', { name: 'About This Mac' });
    expect(aboutWindow).toHaveAttribute('data-focused', 'true');
    expect(
      await within(aboutWindow).findByRole('heading', { name: 'khalah.com' }),
    ).toBeInTheDocument();
    expect(
      within(aboutWindow).getByTestId('window-resize-handle-bottom-right'),
    ).toBeInTheDocument();
  });

  it('passes the launch argument to the app and focuses a window when pressed', async () => {
    renderInDesktopSession(<WindowLayer />, desktopSession);
    act(() => {
      openWindowFor(getInfoAppId, '/Users/guest/Desktop/About Me.txt');
      openWindowFor(getInfoAppId, '/Users/guest/Desktop/Resume.pdf');
    });
    const aboutMeInfoWindow = await screen.findByRole('dialog', {
      name: '/Users/guest/Desktop/About Me.txt Info',
    });
    expect(
      await within(aboutMeInfoWindow).findByRole('heading', { name: 'About Me.txt' }),
    ).toBeInTheDocument();
    expect(aboutMeInfoWindow).toHaveAttribute('data-focused', 'false');

    fireEvent.pointerDown(aboutMeInfoWindow);

    expect(aboutMeInfoWindow).toHaveAttribute('data-focused', 'true');
  });

  // Regression (Phase 1 manual check): windows were rendered in stacking order, so focusing one
  // moved its element in the page, which would reload an iframe inside it (the Phase 4 Browser).
  it('keeps windows in place in the page when focus changes, stacking them with z-index', async () => {
    renderInDesktopSession(<WindowLayer />, desktopSession);
    act(() => {
      openWindowFor(getInfoAppId, '/Users/guest/Desktop/About Me.txt');
      openWindowFor(getInfoAppId, '/Users/guest/Desktop/Resume.pdf');
    });
    const windowsBeforeFocus = await screen.findAllByRole('dialog');
    const [olderWindow, newerWindow] = windowsBeforeFocus;
    if (olderWindow === undefined || newerWindow === undefined) {
      throw new Error('Expected two windows');
    }

    fireEvent.pointerDown(olderWindow);

    expect(screen.getAllByRole('dialog')).toEqual(windowsBeforeFocus);
    expect(Number(olderWindow.style.zIndex)).toBeGreaterThan(Number(newerWindow.style.zIndex));
  });

  it('minimizes, zooms (also by double-clicking the title bar) and closes', async () => {
    renderInDesktopSession(<WindowLayer />, desktopSession);
    let aboutWindowId = '';
    act(() => {
      aboutWindowId = openWindowFor(aboutThisMacAppId);
    });
    const aboutWindow = await screen.findByRole('dialog', { name: 'About This Mac' });
    /**
     * Reads the window's current state from the window manager.
     * @returns The window state.
     */
    const readWindowState = () =>
      desktopSession.windowManagerStore.getState().windowsById[aboutWindowId];

    await userEvent.click(within(aboutWindow).getByRole('button', { name: 'Zoom' }));
    expect(readWindowState()?.isZoomed).toBe(true);
    await userEvent.dblClick(within(aboutWindow).getByTestId('window-title-bar'));
    expect(readWindowState()?.isZoomed).toBe(false);

    await userEvent.click(within(aboutWindow).getByRole('button', { name: 'Minimize' }));
    expect(readWindowState()?.isMinimized).toBe(true);
    act(() => {
      desktopSession.windowManagerStore.getState().restoreWindow(aboutWindowId);
    });

    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'About This Mac' })).getByRole('button', {
        name: 'Close',
      }),
    );
    expect(readWindowState()).toBeUndefined();
  });

  it('closes a window whose app crashed, from the crash message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let aboutWindowId = '';
    act(() => {
      aboutWindowId = openWindowFor(aboutThisMacAppId);
    });
    const aboutWindowState =
      desktopSession.windowManagerStore.getState().windowsById[aboutWindowId];
    const aboutManifest = findAppManifest(aboutThisMacAppId);
    if (aboutWindowState === undefined || aboutManifest === undefined) {
      throw new Error('About This Mac should be open and registered');
    }
    // About This Mac reads isStoredInBrowser while rendering, so this session makes it crash.
    const crashingSession = Object.create(desktopSession, {
      isStoredInBrowser: {
        /**
         * Crashes whoever reads it.
         */
        get: () => {
          throw new Error('Storage exploded');
        },
      },
    }) as DesktopSession;
    renderInDesktopSession(
      <DesktopWindow
        windowState={aboutWindowState}
        appManifest={aboutManifest}
        stackIndex={0}
        isFocused
      />,
      crashingSession,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('About This Mac quit unexpectedly.');
    await userEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Close' }));

    expect(desktopSession.windowManagerStore.getState().windowsById[aboutWindowId]).toBeUndefined();
  });

  it('shows an empty window for an app without registered content', () => {
    const aboutManifest = findAppManifest(aboutThisMacAppId);
    if (aboutManifest === undefined) {
      throw new Error('About This Mac should be registered');
    }
    renderInDesktopSession(
      <DesktopWindow
        windowState={{
          id: 'w-unregistered',
          appId: 'unregistered',
          title: 'Unregistered',
          bounds: { x: 0, y: 0, width: 300, height: 300 },
          isMinimized: false,
          isZoomed: false,
        }}
        appManifest={{ ...aboutManifest, id: 'unregistered' }}
        stackIndex={0}
        isFocused={false}
      />,
      desktopSession,
    );

    const unregisteredWindow = screen.getByRole('dialog', { name: 'Unregistered' });
    expect(within(unregisteredWindow).queryByRole('heading')).toBeNull();
  });

  it('skips windows of unknown apps and reports the desktop area size', () => {
    let reportDesktopAreaSize: ResizeObserverCallback = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        /**
         * Captures the observer callback so the test can report a size.
         * @param resizeCallback - The callback the component registered.
         */
        constructor(resizeCallback: ResizeObserverCallback) {
          reportDesktopAreaSize = resizeCallback;
        }

        /**
         * No-op: the test reports sizes manually.
         */
        observe(): void {
          // The test calls the callback itself.
        }

        /**
         * No-op cleanup.
         */
        disconnect(): void {
          // Nothing to release.
        }
      },
    );
    act(() => {
      desktopSession.windowManagerStore.getState().replaceAllWindows([
        {
          id: 'ghost',
          appId: 'removed-app',
          title: 'Ghost',
          bounds: { x: 0, y: 0, width: 300, height: 300 },
          isMinimized: false,
          isZoomed: false,
          stackPosition: 0,
        },
      ]);
    });
    renderInDesktopSession(<WindowLayer />, desktopSession);

    act(() => {
      reportDesktopAreaSize(
        [{ contentRect: { width: 900, height: 500 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      reportDesktopAreaSize(
        [{ contentRect: { width: 0, height: 0 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      reportDesktopAreaSize([], {} as ResizeObserver);
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(desktopSession.windowManagerStore.getState().desktopAreaSize).toEqual({
      width: 900,
      height: 500,
    });
  });
});
