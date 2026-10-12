import type { AppManifest } from '../../system/app-registry/app-manifest.types.mts';
import type { DesktopWindowState } from '../../system/window-manager/window.types.mts';

/** One thing shown in the Dock. */
export type DockEntry =
  | { kind: 'app'; key: string; appManifest: AppManifest; isRunning: boolean }
  | {
      kind: 'minimized-window';
      key: string;
      windowState: DesktopWindowState;
      appManifest: AppManifest;
    }
  | { kind: 'trash'; key: string; isFull: boolean };

/** Something a Dock item's right-click menu can do. */
export type DockMenuActionId = 'open' | 'quit' | 'show' | 'close' | 'empty-trash';

/** One entry of a Dock item's right-click menu. */
export interface DockMenuAction {
  actionId: DockMenuActionId;
  label: string;
  isDisabled: boolean;
}

/**
 * Builds the Dock's contents, left to right: apps kept in the Dock, then minimized windows, then
 * the Trash.
 * @param appManifests - Every known app.
 * @param stackedWindows - Every open window.
 * @param trashItemCount - How many items are in the Trash.
 * @param findAppManifest - Looks up a window's app.
 * @returns The Dock entries in display order.
 */
export function buildDockEntries(
  appManifests: readonly AppManifest[],
  stackedWindows: readonly DesktopWindowState[],
  trashItemCount: number,
  findAppManifest: (appId: string) => AppManifest | undefined,
): DockEntry[] {
  const runningAppIds = new Set(stackedWindows.map((stackedWindow) => stackedWindow.appId));
  const appEntries: DockEntry[] = appManifests
    .filter((appManifest) => appManifest.isShownInDock)
    .map((appManifest) => ({
      kind: 'app',
      key: `app-${appManifest.id}`,
      appManifest,
      isRunning: runningAppIds.has(appManifest.id),
    }));
  const minimizedWindowEntries: DockEntry[] = stackedWindows.flatMap((stackedWindow) => {
    const windowAppManifest = findAppManifest(stackedWindow.appId);
    if (!stackedWindow.isMinimized || windowAppManifest === undefined) {
      return [];
    }
    return [
      {
        kind: 'minimized-window',
        key: `minimized-${stackedWindow.id}`,
        windowState: stackedWindow,
        appManifest: windowAppManifest,
      },
    ];
  });
  return [
    ...appEntries,
    ...minimizedWindowEntries,
    { kind: 'trash', key: 'trash', isFull: trashItemCount > 0 },
  ];
}

/**
 * Lists what a Dock item's right-click menu offers.
 * @param dockEntry - The item that was right-clicked.
 * @returns The menu actions.
 */
export function listDockMenuActions(dockEntry: DockEntry): DockMenuAction[] {
  switch (dockEntry.kind) {
    case 'app':
      return dockEntry.isRunning
        ? [{ actionId: 'quit', label: 'Quit', isDisabled: false }]
        : [{ actionId: 'open', label: 'Open', isDisabled: false }];
    case 'minimized-window':
      return [
        { actionId: 'show', label: 'Show', isDisabled: false },
        { actionId: 'close', label: 'Close', isDisabled: false },
      ];
    case 'trash':
      return [{ actionId: 'empty-trash', label: 'Empty Trash', isDisabled: !dockEntry.isFull }];
  }
}

/**
 * Describes how a Dock entry is labelled.
 * @param dockEntry - The entry.
 * @returns The visible label and the accessible name.
 */
export function describeDockEntry(dockEntry: DockEntry): { label: string; accessibleName: string } {
  switch (dockEntry.kind) {
    case 'app':
      return {
        label: dockEntry.appManifest.displayName,
        accessibleName: dockEntry.appManifest.displayName,
      };
    case 'minimized-window':
      return {
        label: dockEntry.windowState.title,
        accessibleName: `${dockEntry.windowState.title} (minimized)`,
      };
    case 'trash':
      return { label: 'Trash', accessibleName: 'Trash' };
  }
}

/**
 * Computes which Dock item receives keyboard focus after an arrow, Home or End key (wrapping at the
 * ends, like a toolbar).
 * @param pressedKey - The key's `key` value.
 * @param currentIndex - Index of the focused item.
 * @param itemCount - How many items the Dock has.
 * @returns The index to focus next, or undefined when the key does not move focus.
 */
export function computeNextDockFocusIndex(
  pressedKey: string,
  currentIndex: number,
  itemCount: number,
): number | undefined {
  switch (pressedKey) {
    case 'ArrowRight':
      return (currentIndex + 1) % itemCount;
    case 'ArrowLeft':
      return (currentIndex - 1 + itemCount) % itemCount;
    case 'Home':
      return 0;
    case 'End':
      return itemCount - 1;
    default:
      return undefined;
  }
}
