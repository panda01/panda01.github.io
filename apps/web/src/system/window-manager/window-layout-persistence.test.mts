import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopDatabase } from '../storage/desktop-database.mts';
import {
  loadPersistedWindowLayout,
  startPersistingWindowLayout,
  toPersistedWindowRecords,
} from './window-layout-persistence.mts';
import { createWindowManagerStore } from './window-manager-store.mts';
import type { WindowManagerStore } from './window-manager-store.mts';

let testDatabase: DesktopDatabase;
let windowStore: WindowManagerStore;
let nextWindowNumber: number;

beforeEach(() => {
  testDatabase = new DesktopDatabase(`layout-test-${String(Math.random())}`);
  nextWindowNumber = 1;
  windowStore = createWindowManagerStore(
    { width: 1280, height: 690 },
    () => `w${String(nextWindowNumber++)}`,
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  await testDatabase.delete();
});

/**
 * Opens a Get Info window for a path in the test store.
 * @param itemPath - Path the window describes.
 * @returns The window id.
 */
function openInfoWindow(itemPath: string): string {
  return windowStore.getState().openWindow({
    appId: 'get-info',
    title: `${itemPath} Info`,
    defaultSize: { width: 300, height: 380 },
    launchArgument: itemPath,
    allowsMultipleWindows: true,
  });
}

describe('toPersistedWindowRecords', () => {
  it('numbers windows by stacking position', () => {
    openInfoWindow('/a');
    openInfoWindow('/b');
    windowStore.getState().focusWindow('w1');

    expect(
      toPersistedWindowRecords(windowStore.getState()).map(({ id, stackPosition }) => ({
        id,
        stackPosition,
      })),
    ).toEqual([
      { id: 'w2', stackPosition: 0 },
      { id: 'w1', stackPosition: 1 },
    ]);
  });
});

describe('startPersistingWindowLayout', () => {
  it('saves every layout change and the saved layout can be loaded back', async () => {
    const layoutPersistence = startPersistingWindowLayout(windowStore, testDatabase);
    openInfoWindow('/a');
    openInfoWindow('/b');
    windowStore.getState().moveWindow('w1', { x: 12, y: 34 });
    windowStore.getState().closeWindow('w2');
    await layoutPersistence.waitForPendingWrites();

    const savedLayout = await loadPersistedWindowLayout(testDatabase);
    expect(savedLayout).toHaveLength(1);
    expect(savedLayout[0]).toMatchObject({ id: 'w1', bounds: { x: 12, y: 34 }, stackPosition: 0 });
    layoutPersistence.stopPersisting();
  });

  it('ignores state changes that do not affect windows, and stops when asked', async () => {
    const layoutPersistence = startPersistingWindowLayout(windowStore, testDatabase);
    windowStore.getState().setInterfaceMode('touch');
    await layoutPersistence.waitForPendingWrites();
    expect(await testDatabase.windows.count()).toBe(0);

    layoutPersistence.stopPersisting();
    openInfoWindow('/a');
    await layoutPersistence.waitForPendingWrites();
    expect(await testDatabase.windows.count()).toBe(0);
  });

  it('reports save failures without breaking later saves', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const layoutPersistence = startPersistingWindowLayout(windowStore, testDatabase);
    testDatabase.close();

    openInfoWindow('/a');
    await layoutPersistence.waitForPendingWrites();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Could not save the window layout.',
      expect.anything(),
    );
    layoutPersistence.stopPersisting();
  });

  it('loads saved windows sorted by stacking position', async () => {
    await testDatabase.windows.bulkPut([
      {
        id: 'b',
        appId: 'x',
        title: 'B',
        bounds: { x: 0, y: 0, width: 300, height: 300 },
        isMinimized: false,
        isZoomed: false,
        stackPosition: 2,
      },
      {
        id: 'a',
        appId: 'x',
        title: 'A',
        bounds: { x: 0, y: 0, width: 300, height: 300 },
        isMinimized: false,
        isZoomed: false,
        stackPosition: 1,
      },
    ]);

    expect(
      (await loadPersistedWindowLayout(testDatabase)).map((savedWindow) => savedWindow.id),
    ).toEqual(['a', 'b']);
  });
});
