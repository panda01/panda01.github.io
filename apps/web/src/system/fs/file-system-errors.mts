/**
 * Raised when a path does not point at an existing file, folder or link.
 */
export class FileNotFoundError extends Error {
  /**
   * Creates the error for a missing path.
   * @param missingPath - The path that could not be found.
   */
  constructor(readonly missingPath: string) {
    super(`No such file or folder: ${missingPath}`);
    this.name = 'FileNotFoundError';
  }
}

/**
 * Raised when creating or moving an item would collide with an existing sibling of the same name.
 */
export class FileAlreadyExistsError extends Error {
  /**
   * Creates the error for an occupied path.
   * @param occupiedPath - The path that is already taken.
   */
  constructor(readonly occupiedPath: string) {
    super(`An item named "${occupiedPath}" already exists.`);
    this.name = 'FileAlreadyExistsError';
  }
}

/**
 * Raised when a folder operation targets something that is not a folder (or the reverse).
 */
export class WrongItemKindError extends Error {
  /**
   * Creates the error for an item of the wrong kind.
   * @param itemPath - The path of the offending item.
   * @param expectedKind - What the operation needed, for example "folder".
   */
  constructor(
    readonly itemPath: string,
    readonly expectedKind: string,
  ) {
    super(`Expected ${itemPath} to be a ${expectedKind}.`);
    this.name = 'WrongItemKindError';
  }
}

/**
 * Raised when an operation is not allowed, for example moving a folder into itself or renaming to
 * an invalid name.
 */
export class InvalidFileOperationError extends Error {
  /**
   * Creates the error with a human-readable reason.
   * @param reason - Why the operation was refused.
   */
  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidFileOperationError';
  }
}

/**
 * Raised when the browser refuses to store more data because the site's storage quota is full.
 */
export class StorageQuotaExceededError extends Error {
  /**
   * Creates the error, keeping the browser's original error for debugging.
   * @param originalError - The error thrown by IndexedDB.
   */
  constructor(readonly originalError: unknown) {
    super('Your browser has run out of storage space for this site.');
    this.name = 'StorageQuotaExceededError';
  }
}

/**
 * Reports whether an error thrown by IndexedDB/Dexie means the storage quota is full.
 * @param caughtError - Anything that was thrown.
 * @returns True for quota errors, including Dexie errors that wrap one.
 */
export function isQuotaExceededError(caughtError: unknown): boolean {
  if (!(caughtError instanceof Error)) {
    return false;
  }
  const errorWithInner = caughtError as Error & { inner?: unknown };
  return (
    caughtError.name === 'QuotaExceededError' ||
    (errorWithInner.inner !== undefined && isQuotaExceededError(errorWithInner.inner))
  );
}
