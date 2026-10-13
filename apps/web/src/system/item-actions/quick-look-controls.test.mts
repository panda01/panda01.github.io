import { beforeEach, describe, expect, it } from 'vitest';
import { aboutThisMacAppId, quickLookAppId } from '../app-registry/app-registry.mts';
import { createWindowManagerStore } from '../window-manager/window-manager-store.mts';
import type { WindowManagerStore } from '../window-manager/window-manager-store.mts';
import {
  findVisibleQuickLookWindow,
  followSelectionInQuickLook,
  openQuickLookForItem,
  toggleQuickLookForItem,
} from './quick-look-controls.mts';

let windowStore: WindowManagerStore;

beforeEach(() => {
  windowStore = createWindowManagerStore({ width: 1280, height: 690 });
});

/**
 * Lists the open Quick Look windows.
 * @returns Their titles and launch arguments.
 */
function listQuickLookWindows() {
  return Object.values(windowStore.getState().windowsById)
    .filter((openWindow) => openWindow.appId === quickLookAppId)
    .map(({ title, launchArgument }) => ({ title, launchArgument }));
}

describe('Quick Look controls', () => {
  it('opens one Quick Look window and switches it to whichever item is previewed', () => {
    openQuickLookForItem(windowStore, '/Users/guest/Desktop/About Me.txt');
    openQuickLookForItem(windowStore, '/Users/guest/Desktop/Resume.pdf/');

    expect(listQuickLookWindows()).toEqual([
      { title: 'Resume.pdf', launchArgument: '/Users/guest/Desktop/Resume.pdf' },
    ]);
  });

  it('toggles: Space opens Quick Look, switches items, and closes it on the same item', () => {
    toggleQuickLookForItem(windowStore, '/a.txt');
    expect(listQuickLookWindows()).toEqual([{ title: 'a.txt', launchArgument: '/a.txt' }]);

    toggleQuickLookForItem(windowStore, '/b.txt');
    expect(listQuickLookWindows()).toEqual([{ title: 'b.txt', launchArgument: '/b.txt' }]);

    toggleQuickLookForItem(windowStore, '/b.txt');
    expect(listQuickLookWindows()).toEqual([]);
  });

  it('brings back a minimized Quick Look window instead of closing it', () => {
    openQuickLookForItem(windowStore, '/a.txt');
    const quickLookWindowId = findVisibleQuickLookWindow(windowStore)?.id ?? '';
    windowStore.getState().minimizeWindow(quickLookWindowId);
    expect(findVisibleQuickLookWindow(windowStore)).toBeUndefined();

    toggleQuickLookForItem(windowStore, '/a.txt');

    expect(findVisibleQuickLookWindow(windowStore)?.id).toBe(quickLookWindowId);
  });

  it('follows the selection only while Quick Look is open', () => {
    followSelectionInQuickLook(windowStore, '/a.txt');
    expect(listQuickLookWindows()).toEqual([]);

    windowStore.getState().openWindow({
      appId: aboutThisMacAppId,
      title: 'About This Mac',
      defaultSize: { width: 400, height: 300 },
      allowsMultipleWindows: false,
    });
    openQuickLookForItem(windowStore, '/a.txt');
    followSelectionInQuickLook(windowStore, '/a.txt');
    followSelectionInQuickLook(windowStore, '/b.txt');

    expect(listQuickLookWindows()).toEqual([{ title: 'b.txt', launchArgument: '/b.txt' }]);
  });
});
