import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesktopDatabase, openDesktopDatabase } from './desktop-database.mts';

const openedDatabases: DesktopDatabase[] = [];

afterEach(async () => {
  for (const openedDatabase of openedDatabases.splice(0)) {
    await openedDatabase.delete();
  }
  vi.restoreAllMocks();
});

describe('openDesktopDatabase', () => {
  it('opens the browser database with all tables when IndexedDB works', async () => {
    const { database, isStoredInBrowser } = await openDesktopDatabase('database-test-browser');
    openedDatabases.push(database);

    expect(isStoredInBrowser).toBe(true);
    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'meta',
      'nodes',
      'settings',
      'windows',
    ]);
  });

  it('falls back to an in-memory database when the browser refuses IndexedDB', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const brokenIndexedDb = {
      /**
       * Simulates a browser that refuses IndexedDB.
       */
      open: () => {
        throw new Error('IndexedDB is disabled');
      },
    };

    const { database, isStoredInBrowser } = await openDesktopDatabase('database-test-fallback', {
      indexedDB: brokenIndexedDb,
    });
    openedDatabases.push(database);

    expect(isStoredInBrowser).toBe(false);
    await database.meta.put({ key: 'probe', value: 42 });
    expect(await database.meta.get('probe')).toEqual({ key: 'probe', value: 42 });
  });

  it('enforces unique names within a folder', async () => {
    const { database } = await openDesktopDatabase('database-test-unique');
    openedDatabases.push(database);
    const sharedFields = {
      parentId: 'root',
      name: 'Same',
      kind: 'folder' as const,
      mimeType: 'inode/directory',
      sizeInBytes: 0,
      createdAt: 0,
      modifiedAt: 0,
    };

    await database.nodes.add({ id: 'first', ...sharedFields });

    await expect(database.nodes.add({ id: 'second', ...sharedFields })).rejects.toThrow();
  });
});
