import {
  buildOpenWindowRequest,
  findAppManifest,
  quickLookAppId,
} from '../app-registry/app-registry.mts';
import { normalizePath } from '../fs/path-utilities.mts';
import type { WindowManagerStore } from '../window-manager/window-manager-store.mts';
import type { DesktopWindowState } from '../window-manager/window.types.mts';

/**
 * Finds the Quick Look window if it is open and not minimized.
 * @param windowManagerStore - The window manager.
 * @returns The visible Quick Look window, or undefined.
 */
export function findVisibleQuickLookWindow(
  windowManagerStore: WindowManagerStore,
): DesktopWindowState | undefined {
  return Object.values(windowManagerStore.getState().windowsById).find(
    (openWindow) => openWindow.appId === quickLookAppId && !openWindow.isMinimized,
  );
}

/**
 * Opens Quick Look on an item (switching the Quick Look window to it if it is already open).
 * @param windowManagerStore - The window manager.
 * @param itemPath - Absolute path of the item to preview.
 */
export function openQuickLookForItem(
  windowManagerStore: WindowManagerStore,
  itemPath: string,
): void {
  const quickLookManifest = findAppManifest(quickLookAppId);
  if (quickLookManifest === undefined) {
    return;
  }
  windowManagerStore
    .getState()
    .openWindow(buildOpenWindowRequest(quickLookManifest, normalizePath(itemPath)));
}

/**
 * What the Space bar does on a selected item, like macOS: opens Quick Look on it, or closes Quick
 * Look when it is already showing that item.
 * @param windowManagerStore - The window manager.
 * @param itemPath - Absolute path of the selected item.
 */
export function toggleQuickLookForItem(
  windowManagerStore: WindowManagerStore,
  itemPath: string,
): void {
  const visibleQuickLookWindow = findVisibleQuickLookWindow(windowManagerStore);
  const isAlreadyPreviewingItem =
    visibleQuickLookWindow?.launchArgument === normalizePath(itemPath);
  if (visibleQuickLookWindow !== undefined && isAlreadyPreviewingItem) {
    windowManagerStore.getState().closeWindow(visibleQuickLookWindow.id);
    return;
  }
  openQuickLookForItem(windowManagerStore, itemPath);
}

/**
 * Keeps an open Quick Look window on the selected item as the selection moves (for example with
 * the arrow keys in Finder). Does nothing while Quick Look is closed.
 * @param windowManagerStore - The window manager.
 * @param selectedItemPath - Absolute path of the newly selected item.
 */
export function followSelectionInQuickLook(
  windowManagerStore: WindowManagerStore,
  selectedItemPath: string,
): void {
  const visibleQuickLookWindow = findVisibleQuickLookWindow(windowManagerStore);
  const isShowingAnotherItem =
    visibleQuickLookWindow !== undefined &&
    visibleQuickLookWindow.launchArgument !== normalizePath(selectedItemPath);
  if (isShowingAnotherItem) {
    openQuickLookForItem(windowManagerStore, selectedItemPath);
  }
}
