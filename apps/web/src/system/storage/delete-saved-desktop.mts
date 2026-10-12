import { Dexie } from 'dexie';
import { defaultDesktopDatabaseName } from './desktop-database.mts';

/**
 * Deletes the visitor's whole saved desktop from the browser. Used by the recovery screens when the
 * saved data itself prevents the desktop from starting.
 * @param databaseName - The database to delete.
 * @returns Resolves once the database is gone.
 */
export async function deleteSavedDesktop(
  databaseName: string = defaultDesktopDatabaseName,
): Promise<void> {
  await Dexie.delete(databaseName);
}
