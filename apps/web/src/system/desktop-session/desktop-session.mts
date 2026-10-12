import { VirtualFileSystem } from '../fs/virtual-file-system.mts';
import { currentSeedVersion, defaultDesktopSeedEntries } from '../seed/default-desktop-seed.mts';
import { resetDesktop, seedDesktop } from '../seed/desktop-seeding.mts';
import type { SeedFileLoader, SeedingDependencies } from '../seed/desktop-seeding.mts';
import { defaultDesktopDatabaseName, openDesktopDatabase } from '../storage/desktop-database.mts';
import type { DesktopDatabase } from '../storage/desktop-database.mts';
import { requestPersistentStorage } from '../storage/persistent-storage.mts';
import {
  loadPersistedWindowLayout,
  startPersistingWindowLayout,
} from '../window-manager/window-layout-persistence.mts';
import { createWindowManagerStore } from '../window-manager/window-manager-store.mts';
import type { WindowManagerStore } from '../window-manager/window-manager-store.mts';
import type { DesktopAreaSize } from '../window-manager/window.types.mts';

/** Everything a running desktop needs, created once at boot. */
export interface DesktopSession {
  database: DesktopDatabase;
  fileSystem: VirtualFileSystem;
  windowManagerStore: WindowManagerStore;
  /** False when the browser refused storage and the desktop lives only in memory for this visit. */
  isStoredInBrowser: boolean;
  /** Throws away the visitor's changes and restores the default desktop. */
  resetToDefaultDesktop: () => Promise<void>;
  /** Stops saving and closes the database (used when the page unmounts). */
  endSession: () => void;
}

/** Inputs for starting a session; tests pass their own database name and seed loader. */
export interface DesktopSessionOptions {
  loadSeedFile: SeedFileLoader;
  initialDesktopAreaSize: DesktopAreaSize;
  /** `navigator.storage`, used to ask the browser to keep the desktop's data. */
  storageManager: StorageManager | undefined;
  databaseName?: string;
}

/**
 * Starts the visitor's desktop: opens their database (or an in-memory fallback), creates or
 * upgrades the default desktop, restores their saved window layout, and starts saving changes.
 * @param sessionOptions - Seed loader, screen size, storage manager and optional database name.
 * @returns The running session.
 */
export async function startDesktopSession(
  sessionOptions: DesktopSessionOptions,
): Promise<DesktopSession> {
  const { database, isStoredInBrowser } = await openDesktopDatabase(
    sessionOptions.databaseName ?? defaultDesktopDatabaseName,
  );
  const fileSystem = new VirtualFileSystem(database);
  const seedingDependencies: SeedingDependencies = {
    database,
    fileSystem,
    seedEntries: defaultDesktopSeedEntries,
    seedVersion: currentSeedVersion,
    loadSeedFile: sessionOptions.loadSeedFile,
  };
  await seedDesktop(seedingDependencies);

  const windowManagerStore = createWindowManagerStore(sessionOptions.initialDesktopAreaSize);
  windowManagerStore.getState().replaceAllWindows(await loadPersistedWindowLayout(database));
  const windowLayoutPersistence = startPersistingWindowLayout(windowManagerStore, database);
  void requestPersistentStorage(sessionOptions.storageManager);

  return {
    database,
    fileSystem,
    windowManagerStore,
    isStoredInBrowser,
    /**
     * Closes every window, waits for saves to finish, then wipes and reseeds the desktop.
     * @returns Resolves once the default desktop is back.
     */
    resetToDefaultDesktop: async () => {
      windowManagerStore.getState().replaceAllWindows([]);
      await windowLayoutPersistence.waitForPendingWrites();
      await resetDesktop(seedingDependencies);
    },
    /**
     * Stops saving the layout and closes the database.
     */
    endSession: () => {
      windowLayoutPersistence.stopPersisting();
      database.close();
    },
  };
}
