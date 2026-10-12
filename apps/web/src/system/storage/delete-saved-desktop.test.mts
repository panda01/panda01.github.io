import { Dexie } from 'dexie';
import { describe, expect, it } from 'vitest';
import { deleteSavedDesktop } from './delete-saved-desktop.mts';
import { DesktopDatabase, defaultDesktopDatabaseName } from './desktop-database.mts';

describe('deleteSavedDesktop', () => {
  it('removes the whole saved desktop database', async () => {
    const databaseName = `delete-test-${String(Math.random())}`;
    const savedDesktop = new DesktopDatabase(databaseName);
    await savedDesktop.meta.put({ key: 'seedVersion', value: 1 });
    savedDesktop.close();

    await deleteSavedDesktop(databaseName);

    expect(await Dexie.exists(databaseName)).toBe(false);
  });

  it('deletes the default database when no name is given', async () => {
    const defaultDesktop = new DesktopDatabase();
    await defaultDesktop.meta.put({ key: 'seedVersion', value: 1 });
    defaultDesktop.close();

    await deleteSavedDesktop();

    expect(await Dexie.exists(defaultDesktopDatabaseName)).toBe(false);
  });
});
