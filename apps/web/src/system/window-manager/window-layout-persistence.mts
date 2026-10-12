import type { DesktopDatabase } from '../storage/desktop-database.mts';
import { selectWindowsInStackOrder } from './window-manager-store.mts';
import type { WindowManagerState, WindowManagerStore } from './window-manager-store.mts';
import type { PersistedWindowRecord } from './window.types.mts';

/** Handle returned while the window layout is being saved automatically. */
export interface WindowLayoutPersistence {
  /** Stops saving future changes. */
  stopPersisting: () => void;
  /** Resolves once every queued save has finished (used by tests and before a reset). */
  waitForPendingWrites: () => Promise<void>;
}

/**
 * Reads the saved window layout.
 * @param database - The visitor's desktop database.
 * @returns The saved windows from bottom to top.
 */
export async function loadPersistedWindowLayout(
  database: DesktopDatabase,
): Promise<PersistedWindowRecord[]> {
  const persistedWindows = await database.windows.toArray();
  return persistedWindows.sort(
    (firstWindow, secondWindow) => firstWindow.stackPosition - secondWindow.stackPosition,
  );
}

/**
 * Converts the window manager state into the records saved in IndexedDB.
 * @param windowManagerState - The current window manager state.
 * @returns One record per open window, numbered by stacking position.
 */
export function toPersistedWindowRecords(
  windowManagerState: WindowManagerState,
): PersistedWindowRecord[] {
  return selectWindowsInStackOrder(windowManagerState).map((stackedWindow, stackPosition) => ({
    ...stackedWindow,
    stackPosition,
  }));
}

/**
 * Saves the window layout to IndexedDB every time windows open, close, move, resize, minimize or
 * change order, so the visitor finds their windows where they left them after a reload. Saves are
 * written immediately (not debounced) and one at a time, so a reload right after a drag still keeps
 * the new position.
 * @param windowManagerStore - The window manager store to watch.
 * @param database - The visitor's desktop database.
 * @returns Controls to stop saving and to wait for pending saves.
 */
export function startPersistingWindowLayout(
  windowManagerStore: WindowManagerStore,
  database: DesktopDatabase,
): WindowLayoutPersistence {
  let pendingWrites: Promise<void> = Promise.resolve();

  const unsubscribeFromStore = windowManagerStore.subscribe((currentState, previousState) => {
    const hasWindowLayoutChanged =
      currentState.windowsById !== previousState.windowsById ||
      currentState.windowStackOrder !== previousState.windowStackOrder;
    if (!hasWindowLayoutChanged) {
      return;
    }
    const recordsToSave = toPersistedWindowRecords(currentState);
    pendingWrites = pendingWrites
      .then(() =>
        database.transaction('rw', database.windows, async () => {
          await database.windows.clear();
          await database.windows.bulkPut(recordsToSave);
        }),
      )
      .catch((saveError: unknown) => {
        console.error('Could not save the window layout.', saveError);
      });
  });

  return {
    stopPersisting: unsubscribeFromStore,
    /**
     * Waits for queued saves.
     * @returns Resolves when every queued save has finished.
     */
    waitForPendingWrites: () => pendingWrites,
  };
}
