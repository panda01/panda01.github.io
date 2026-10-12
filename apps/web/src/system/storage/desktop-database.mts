import { Dexie } from 'dexie';
import type { DexieOptions, EntityTable } from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import type { FileSystemNodeRecord } from '../fs/file-system.types.mts';
import type { PersistedWindowRecord } from '../window-manager/window.types.mts';

/** Name of the IndexedDB database that holds a visitor's desktop. */
export const defaultDesktopDatabaseName = 'khalah-desktop';

/** A simple key/value row, used for settings and bookkeeping such as the seed version. */
export interface KeyValueRecord {
  key: string;
  value: unknown;
}

/**
 * The visitor's whole desktop as stored in their browser: filesystem items, open windows, settings,
 * and internal bookkeeping. Each schema change must add a new `version(n)` with an upgrade and a test.
 */
export class DesktopDatabase extends Dexie {
  declare nodes: EntityTable<FileSystemNodeRecord, 'id'>;
  declare windows: EntityTable<PersistedWindowRecord, 'id'>;
  declare settings: EntityTable<KeyValueRecord, 'key'>;
  declare meta: EntityTable<KeyValueRecord, 'key'>;

  /**
   * Declares the database schema.
   * @param databaseName - The IndexedDB database name.
   * @param dexieOptions - Optional Dexie options, for example an alternative IndexedDB implementation.
   */
  constructor(databaseName: string = defaultDesktopDatabaseName, dexieOptions?: DexieOptions) {
    super(databaseName, dexieOptions);
    this.version(1).stores({
      nodes: 'id, parentId, &[parentId+name]',
      windows: 'id',
      settings: 'key',
      meta: 'key',
    });
  }
}

/** The opened database plus whether it is actually persisted in the visitor's browser. */
export interface OpenedDesktopDatabase {
  database: DesktopDatabase;
  /** False when the browser refused IndexedDB and an in-memory database is used instead. */
  isStoredInBrowser: boolean;
}

/**
 * Opens the visitor's desktop database. If the browser refuses IndexedDB (for example some private
 * browsing modes), falls back to an in-memory database so the desktop still works for this visit.
 * @param databaseName - The IndexedDB database name.
 * @param browserDexieOptions - Options for the browser database (tests use this to simulate failures).
 * @returns The opened database and whether it is persisted.
 */
export async function openDesktopDatabase(
  databaseName: string = defaultDesktopDatabaseName,
  browserDexieOptions?: DexieOptions,
): Promise<OpenedDesktopDatabase> {
  const browserDatabase = new DesktopDatabase(databaseName, browserDexieOptions);
  try {
    await browserDatabase.open();
    return { database: browserDatabase, isStoredInBrowser: true };
  } catch (browserStorageError) {
    console.warn('Browser storage unavailable; using in-memory storage.', browserStorageError);
    browserDatabase.close();
    const inMemoryDatabase = new DesktopDatabase(databaseName, {
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    await inMemoryDatabase.open();
    return { database: inMemoryDatabase, isStoredInBrowser: false };
  }
}
