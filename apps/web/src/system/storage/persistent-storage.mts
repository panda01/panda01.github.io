/**
 * Asks the browser to keep this site's storage even when disk space runs low, so a visitor's
 * desktop is not silently evicted. Browsers may grant or refuse this without asking the visitor.
 * @param storageManager - The browser's storage manager (`navigator.storage`), which is missing in
 *   some older browsers.
 * @returns Whether storage is persistent; false when the browser refuses or lacks the API.
 */
export async function requestPersistentStorage(
  storageManager: StorageManager | undefined,
): Promise<boolean> {
  if (typeof storageManager?.persist !== 'function') {
    return false;
  }
  try {
    const isAlreadyPersistent = await storageManager.persisted();
    return isAlreadyPersistent || (await storageManager.persist());
  } catch {
    return false;
  }
}
