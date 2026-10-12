import { describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './persistent-storage.mts';

/**
 * Builds a fake storage manager.
 * @param isPersisted - What `persisted()` resolves to.
 * @param persistResult - What `persist()` resolves to, or an error to reject with.
 * @returns The fake manager and its persist spy.
 */
function createFakeStorageManager(isPersisted: boolean, persistResult: boolean | Error) {
  const persist = vi.fn(() =>
    persistResult instanceof Error ? Promise.reject(persistResult) : Promise.resolve(persistResult),
  );
  return {
    storageManager: {
      /**
       * Reports whether storage is already persistent.
       * @returns The configured answer.
       */
      persisted: () => Promise.resolve(isPersisted),
      persist,
    } as unknown as StorageManager,
    persist,
  };
}

describe('requestPersistentStorage', () => {
  it('reports already-persistent storage without asking again', async () => {
    const { storageManager, persist } = createFakeStorageManager(true, false);
    expect(await requestPersistentStorage(storageManager)).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('asks for persistence and reports the answer', async () => {
    expect(
      await requestPersistentStorage(createFakeStorageManager(false, true).storageManager),
    ).toBe(true);
    expect(
      await requestPersistentStorage(createFakeStorageManager(false, false).storageManager),
    ).toBe(false);
  });

  it('returns false when the API is missing or fails', async () => {
    expect(await requestPersistentStorage(undefined)).toBe(false);
    expect(await requestPersistentStorage({} as StorageManager)).toBe(false);
    expect(
      await requestPersistentStorage(
        createFakeStorageManager(false, new Error('no')).storageManager,
      ),
    ).toBe(false);
  });

  it('works with the browser storage manager', async () => {
    expect(typeof (await requestPersistentStorage(navigator.storage))).toBe('boolean');
  });
});
