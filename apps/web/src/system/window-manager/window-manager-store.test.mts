import { beforeEach, describe, expect, it } from 'vitest';
import { dockReservedHeightInPixels } from './window-geometry.mts';
import {
  createWindowManagerStore,
  selectFocusedAppId,
  selectFocusedWindow,
  selectTopmostWindowOfApp,
  selectWindowsInOpeningOrder,
  selectWindowsInStackOrder,
} from './window-manager-store.mts';
import type { OpenWindowRequest, WindowManagerStore } from './window-manager-store.mts';

const desktopArea = { width: 1280, height: 690 };
const aboutRequest: OpenWindowRequest = {
  appId: 'about',
  title: 'About This Mac',
  defaultSize: { width: 400, height: 300 },
  allowsMultipleWindows: false,
};

/**
 * Builds a Get Info request for a path.
 * @param itemPath - The path the info window describes.
 * @returns The request.
 */
function getInfoRequest(itemPath: string): OpenWindowRequest {
  return {
    appId: 'get-info',
    title: `${itemPath} Info`,
    defaultSize: { width: 300, height: 380 },
    launchArgument: itemPath,
    allowsMultipleWindows: true,
  };
}

let windowStore: WindowManagerStore;
let nextWindowNumber: number;

beforeEach(() => {
  nextWindowNumber = 1;
  windowStore = createWindowManagerStore(desktopArea, () => `w${String(nextWindowNumber++)}`);
});

describe('opening windows', () => {
  it('opens a window at a cascaded position and focuses it', () => {
    const windowId = windowStore.getState().openWindow(aboutRequest);

    expect(windowId).toBe('w1');
    expect(selectFocusedWindow(windowStore.getState())).toMatchObject({
      id: 'w1',
      title: 'About This Mac',
      bounds: { x: 440, y: 130, width: 400, height: 300 },
      isMinimized: false,
      isZoomed: false,
    });
    expect(selectFocusedAppId(windowStore.getState())).toBe('about');
  });

  it('reuses the window of a single-window app and restores it if minimized', () => {
    const firstWindowId = windowStore.getState().openWindow(aboutRequest);
    windowStore.getState().minimizeWindow(firstWindowId);

    expect(windowStore.getState().openWindow(aboutRequest)).toBe(firstWindowId);
    expect(windowStore.getState().windowsById[firstWindowId]?.isMinimized).toBe(false);
  });

  it('opens one window per launch argument for multi-window apps', () => {
    const firstInfoId = windowStore.getState().openWindow(getInfoRequest('/a'));
    const secondInfoId = windowStore.getState().openWindow(getInfoRequest('/b'));

    expect(firstInfoId).not.toBe(secondInfoId);
    expect(windowStore.getState().openWindow(getInfoRequest('/a'))).toBe(firstInfoId);
    expect(windowStore.getState().windowsById[secondInfoId]?.bounds.x).toBe(
      (windowStore.getState().windowsById[firstInfoId]?.bounds.x ?? 0) + 26,
    );
  });

  it('always opens a new window for multi-window apps without a launch argument', () => {
    const requestWithoutArgument: OpenWindowRequest = {
      appId: 'get-info',
      title: 'Untitled',
      defaultSize: { width: 300, height: 380 },
      allowsMultipleWindows: true,
    };
    const firstId = windowStore.getState().openWindow(requestWithoutArgument);
    const secondId = windowStore.getState().openWindow(requestWithoutArgument);

    expect(firstId).not.toBe(secondId);
    expect(windowStore.getState().windowsById[firstId]?.launchArgument).toBeUndefined();
  });
});

describe('changing what a window shows', () => {
  it('switches a single-window app to a new launch argument and title when asked again', () => {
    const quickLookRequest = {
      appId: 'quick-look',
      defaultSize: { width: 500, height: 400 },
      allowsMultipleWindows: false,
    };
    const windowId = windowStore
      .getState()
      .openWindow({ ...quickLookRequest, title: 'A.txt', launchArgument: '/A.txt' });
    windowStore.getState().openWindow(aboutRequest);

    const reusedWindowId = windowStore
      .getState()
      .openWindow({ ...quickLookRequest, title: 'B.pdf', launchArgument: '/B.pdf' });

    expect(reusedWindowId).toBe(windowId);
    expect(windowStore.getState().windowsById[windowId]).toMatchObject({
      title: 'B.pdf',
      launchArgument: '/B.pdf',
    });
    expect(selectFocusedWindow(windowStore.getState())?.id).toBe(windowId);
  });

  it('updates a window title and launch argument, and changes nothing when they are the same', () => {
    const windowId = windowStore.getState().openWindow(getInfoRequest('/a'));

    windowStore.getState().updateWindowTitleAndLaunchArgument(windowId, 'Projects', '/Projects');
    expect(windowStore.getState().windowsById[windowId]).toMatchObject({
      title: 'Projects',
      launchArgument: '/Projects',
    });

    const windowsBeforeRepeat = windowStore.getState().windowsById;
    windowStore.getState().updateWindowTitleAndLaunchArgument(windowId, 'Projects', '/Projects');
    windowStore.getState().updateWindowTitleAndLaunchArgument('missing', 'X', '/x');
    expect(windowStore.getState().windowsById).toBe(windowsBeforeRepeat);
  });

  it("finds an app's front-most window, minimized or not", () => {
    const olderInfoWindowId = windowStore.getState().openWindow(getInfoRequest('/a'));
    const newerInfoWindowId = windowStore.getState().openWindow(getInfoRequest('/b'));
    windowStore.getState().openWindow(aboutRequest);
    windowStore.getState().minimizeWindow(newerInfoWindowId);

    expect(selectTopmostWindowOfApp(windowStore.getState(), 'get-info')?.id).toBe(
      newerInfoWindowId,
    );
    windowStore.getState().focusWindow(olderInfoWindowId);
    expect(selectTopmostWindowOfApp(windowStore.getState(), 'get-info')?.id).toBe(
      olderInfoWindowId,
    );
    expect(selectTopmostWindowOfApp(windowStore.getState(), 'finder')).toBeUndefined();
  });
});

describe('focus and stacking', () => {
  it('lists windows in opening order regardless of focus', () => {
    windowStore.getState().openWindow(getInfoRequest('/a'));
    windowStore.getState().openWindow(getInfoRequest('/b'));

    windowStore.getState().focusWindow('w1');

    expect(
      selectWindowsInOpeningOrder(windowStore.getState()).map((openWindow) => openWindow.id),
    ).toEqual(['w1', 'w2']);
  });

  it('does not change the state when the window is already on top', () => {
    windowStore.getState().openWindow(getInfoRequest('/a'));
    const stackOrderBeforeFocus = windowStore.getState().windowStackOrder;

    windowStore.getState().focusWindow('w1');

    expect(windowStore.getState().windowStackOrder).toBe(stackOrderBeforeFocus);
  });

  it('raises a focused window to the top and ignores unknown ids', () => {
    windowStore.getState().openWindow(getInfoRequest('/a'));
    windowStore.getState().openWindow(getInfoRequest('/b'));

    windowStore.getState().focusWindow('w1');
    windowStore.getState().focusWindow('nope');

    expect(windowStore.getState().windowStackOrder).toEqual(['w2', 'w1']);
    expect(selectFocusedWindow(windowStore.getState())?.id).toBe('w1');
  });

  it('focuses the next visible window when the top one is minimized', () => {
    windowStore.getState().openWindow(getInfoRequest('/a'));
    windowStore.getState().openWindow(getInfoRequest('/b'));

    windowStore.getState().minimizeWindow('w2');
    expect(selectFocusedWindow(windowStore.getState())?.id).toBe('w1');

    windowStore.getState().minimizeWindow('w1');
    expect(selectFocusedWindow(windowStore.getState())).toBeUndefined();
    expect(selectFocusedAppId(windowStore.getState())).toBeUndefined();
  });

  it('restoring a minimized window brings it to the front', () => {
    windowStore.getState().openWindow(getInfoRequest('/a'));
    windowStore.getState().openWindow(getInfoRequest('/b'));
    windowStore.getState().minimizeWindow('w1');

    windowStore.getState().restoreWindow('w1');

    expect(windowStore.getState().windowStackOrder).toEqual(['w2', 'w1']);
    expect(windowStore.getState().windowsById.w1?.isMinimized).toBe(false);
  });
});

describe('closing windows', () => {
  it('closes one window or every window of an app', () => {
    windowStore.getState().openWindow(aboutRequest);
    windowStore.getState().openWindow(getInfoRequest('/a'));
    windowStore.getState().openWindow(getInfoRequest('/b'));

    windowStore.getState().closeWindow('w1');
    expect(windowStore.getState().windowStackOrder).toEqual(['w2', 'w3']);

    windowStore.getState().closeAllWindowsOfApp('get-info');
    expect(windowStore.getState().windowsById).toEqual({});
    expect(selectWindowsInStackOrder(windowStore.getState())).toEqual([]);
  });

  it('ignores changes to windows that do not exist', () => {
    windowStore.getState().minimizeWindow('missing');
    expect(windowStore.getState().windowsById).toEqual({});
  });
});

describe('zooming, moving and resizing', () => {
  it('zooms to fill the area above the Dock and restores the previous bounds', () => {
    const windowId = windowStore.getState().openWindow(aboutRequest);
    const originalBounds = windowStore.getState().windowsById[windowId]?.bounds;

    windowStore.getState().toggleWindowZoom(windowId);
    expect(windowStore.getState().windowsById[windowId]).toMatchObject({
      isZoomed: true,
      bounds: { x: 0, y: 0, width: 1280, height: 690 - dockReservedHeightInPixels },
    });

    windowStore.getState().toggleWindowZoom(windowId);
    expect(windowStore.getState().windowsById[windowId]?.bounds).toEqual(originalBounds);
    expect(windowStore.getState().windowsById[windowId]?.boundsBeforeZoom).toBeUndefined();
  });

  it('moves and resizes within the desktop area, leaving the zoomed state', () => {
    const windowId = windowStore.getState().openWindow(aboutRequest);
    windowStore.getState().toggleWindowZoom(windowId);

    // The zoomed window is as wide as the screen, so it cannot move right; it also cannot go above
    // the menu bar.
    windowStore.getState().moveWindow(windowId, { x: 10, y: -300 });
    expect(windowStore.getState().windowsById[windowId]).toMatchObject({
      isZoomed: false,
      bounds: { x: 0, y: 0, width: 1280 },
    });
    expect(windowStore.getState().windowsById[windowId]?.boundsBeforeZoom).toBeUndefined();

    windowStore.getState().resizeWindow(windowId, { x: 20, y: 30, width: 500, height: 350 });
    expect(windowStore.getState().windowsById[windowId]?.bounds).toEqual({
      x: 20,
      y: 30,
      width: 500,
      height: 350,
    });
  });

  it('un-zooms using the current bounds when no previous bounds were kept', () => {
    windowStore.getState().replaceAllWindows([
      {
        id: 'zoomed',
        appId: 'about',
        title: 'About This Mac',
        bounds: { x: 0, y: 0, width: 600, height: 400 },
        isMinimized: false,
        isZoomed: true,
        stackPosition: 0,
      },
    ]);

    windowStore.getState().toggleWindowZoom('zoomed');

    expect(windowStore.getState().windowsById.zoomed?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 600,
      height: 400,
    });
  });
});

describe('desktop area and restoring saved layouts', () => {
  it('pulls windows back into view and re-zooms zoomed windows when the screen shrinks', () => {
    const plainWindowId = windowStore.getState().openWindow(aboutRequest);
    const zoomedWindowId = windowStore.getState().openWindow(getInfoRequest('/a'));
    windowStore.getState().moveWindow(plainWindowId, { x: 800, y: 300 });
    windowStore.getState().toggleWindowZoom(zoomedWindowId);

    windowStore.getState().setDesktopAreaSize({ width: 800, height: 500 });

    expect(windowStore.getState().windowsById[plainWindowId]?.bounds).toEqual({
      x: 400,
      y: 200,
      width: 400,
      height: 300,
    });
    expect(windowStore.getState().windowsById[zoomedWindowId]?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 500 - dockReservedHeightInPixels,
    });
  });

  it('replaces all windows from a saved layout in stacking order', () => {
    windowStore.getState().replaceAllWindows([
      {
        id: 'top',
        appId: 'get-info',
        launchArgument: '/a',
        title: 'a Info',
        bounds: { x: 9000, y: 9000, width: 300, height: 380 },
        boundsBeforeZoom: { x: 1, y: 1, width: 300, height: 300 },
        isMinimized: false,
        isZoomed: false,
        stackPosition: 5,
      },
      {
        id: 'bottom',
        appId: 'about',
        title: 'About This Mac',
        bounds: { x: 0, y: 0, width: 400, height: 300 },
        isMinimized: true,
        isZoomed: false,
        stackPosition: 1,
      },
    ]);

    expect(windowStore.getState().windowStackOrder).toEqual(['bottom', 'top']);
    expect(windowStore.getState().windowsById.top).toMatchObject({
      launchArgument: '/a',
      boundsBeforeZoom: { x: 1, y: 1 },
      bounds: { x: 980, y: 310 },
    });
    expect(windowStore.getState().windowsById.bottom?.launchArgument).toBeUndefined();
  });

  it('switches between desktop and touch modes', () => {
    windowStore.getState().setInterfaceMode('touch');
    expect(windowStore.getState().interfaceMode).toBe('touch');
  });
});

describe('default window ids', () => {
  it('generates unique window ids when none are supplied', () => {
    const storeWithDefaultIds = createWindowManagerStore(desktopArea);
    const firstId = storeWithDefaultIds.getState().openWindow(getInfoRequest('/a'));
    const secondId = storeWithDefaultIds.getState().openWindow(getInfoRequest('/b'));

    expect(firstId).toMatch(/^window-/);
    expect(firstId).not.toBe(secondId);
  });
});
