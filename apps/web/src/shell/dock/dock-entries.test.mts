import { describe, expect, it } from 'vitest';
import {
  aboutThisMacAppId,
  appManifests,
  findAppManifest,
  finderAppId,
  getInfoAppId,
} from '../../system/app-registry/app-registry.mts';
import type { DesktopWindowState } from '../../system/window-manager/window.types.mts';
import {
  buildDockEntries,
  computeNextDockFocusIndex,
  describeDockEntry,
  listDockMenuActions,
} from './dock-entries.mts';
import type { DockEntry } from './dock-entries.mts';

/**
 * Builds a window state for the given app.
 * @param windowId - The window id.
 * @param appId - The owning app.
 * @param isMinimized - Whether the window is minimized.
 * @returns The window state.
 */
function buildWindow(windowId: string, appId: string, isMinimized: boolean): DesktopWindowState {
  return {
    id: windowId,
    appId,
    title: `${windowId} title`,
    bounds: { x: 0, y: 0, width: 300, height: 300 },
    isMinimized,
    isZoomed: false,
  };
}

/**
 * Finds an entry by kind, failing the test if it is missing.
 * @param dockEntries - The entries to search.
 * @param entryKind - The kind to find.
 * @returns The first entry of that kind.
 */
function findEntryOfKind<EntryKind extends DockEntry['kind']>(
  dockEntries: DockEntry[],
  entryKind: EntryKind,
): Extract<DockEntry, { kind: EntryKind }> {
  const foundEntry = dockEntries.find((dockEntry) => dockEntry.kind === entryKind);
  if (foundEntry?.kind !== entryKind) {
    throw new Error(`No ${entryKind} entry`);
  }
  return foundEntry as Extract<DockEntry, { kind: EntryKind }>;
}

describe('buildDockEntries', () => {
  it('lists Dock apps, then minimized windows, then the Trash', () => {
    const dockEntries = buildDockEntries(
      appManifests,
      [
        buildWindow('w1', aboutThisMacAppId, false),
        buildWindow('w2', getInfoAppId, true),
        buildWindow('w3', 'removed-app', true),
      ],
      2,
      findAppManifest,
    );

    expect(dockEntries.map((dockEntry) => dockEntry.key)).toEqual([
      `app-${finderAppId}`,
      `app-${aboutThisMacAppId}`,
      'minimized-w2',
      'trash',
    ]);
    expect(
      dockEntries
        .filter((dockEntry) => dockEntry.kind === 'app')
        .map((appEntry) => [appEntry.appManifest.id, appEntry.isRunning]),
    ).toEqual([
      [finderAppId, false],
      [aboutThisMacAppId, true],
    ]);
    expect(findEntryOfKind(dockEntries, 'trash').isFull).toBe(true);
  });

  it('shows apps as not running and an empty Trash when nothing is open', () => {
    const dockEntries = buildDockEntries(appManifests, [], 0, findAppManifest);

    expect(findEntryOfKind(dockEntries, 'app').isRunning).toBe(false);
    expect(findEntryOfKind(dockEntries, 'trash').isFull).toBe(false);
  });
});

describe('Dock entry menus and labels', () => {
  const entriesWithEverything = buildDockEntries(
    appManifests,
    [buildWindow('w2', getInfoAppId, true)],
    0,
    findAppManifest,
  );

  it('offers Open for stopped apps and Quit for running apps', () => {
    const stoppedApp = findEntryOfKind(entriesWithEverything, 'app');
    expect(listDockMenuActions(stoppedApp).map((action) => action.label)).toEqual(['Open']);
    expect(
      listDockMenuActions({ ...stoppedApp, isRunning: true }).map((action) => action.label),
    ).toEqual(['Quit']);
  });

  it('offers Show and Close for minimized windows, and Empty Trash only when full', () => {
    const minimizedWindow = findEntryOfKind(entriesWithEverything, 'minimized-window');
    const emptyTrash = findEntryOfKind(entriesWithEverything, 'trash');

    expect(listDockMenuActions(minimizedWindow).map((action) => action.label)).toEqual([
      'Show',
      'Close',
    ]);
    expect(listDockMenuActions(emptyTrash)).toEqual([
      { actionId: 'empty-trash', label: 'Empty Trash', isDisabled: true },
    ]);
    expect(listDockMenuActions({ ...emptyTrash, isFull: true })[0]?.isDisabled).toBe(false);
  });

  it('labels each kind of entry', () => {
    expect(describeDockEntry(findEntryOfKind(entriesWithEverything, 'app'))).toEqual({
      label: 'Finder',
      accessibleName: 'Finder',
    });
    expect(describeDockEntry(findEntryOfKind(entriesWithEverything, 'minimized-window'))).toEqual({
      label: 'w2 title',
      accessibleName: 'w2 title (minimized)',
    });
    expect(describeDockEntry(findEntryOfKind(entriesWithEverything, 'trash'))).toEqual({
      label: 'Trash',
      accessibleName: 'Trash',
    });
  });
});

describe('computeNextDockFocusIndex', () => {
  it.each([
    ['ArrowRight', 0, 1],
    ['ArrowRight', 2, 0],
    ['ArrowLeft', 0, 2],
    ['ArrowLeft', 2, 1],
    ['Home', 2, 0],
    ['End', 0, 2],
  ])('moves focus on %s from %d to %d (3 items)', (pressedKey, currentIndex, expectedIndex) => {
    expect(computeNextDockFocusIndex(pressedKey, currentIndex, 3)).toBe(expectedIndex);
  });

  it('ignores other keys', () => {
    expect(computeNextDockFocusIndex('Enter', 1, 3)).toBeUndefined();
  });
});
