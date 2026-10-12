import { describe, expect, it } from 'vitest';
import {
  FileAlreadyExistsError,
  FileNotFoundError,
  InvalidFileOperationError,
  StorageQuotaExceededError,
  WrongItemKindError,
  isQuotaExceededError,
} from './file-system-errors.mts';

describe('file system errors', () => {
  it('describe the problem and keep their context', () => {
    expect(new FileNotFoundError('/a').message).toBe('No such file or folder: /a');
    expect(new FileNotFoundError('/a').missingPath).toBe('/a');
    expect(new FileAlreadyExistsError('/b').occupiedPath).toBe('/b');
    expect(new WrongItemKindError('/c', 'folder').message).toBe('Expected /c to be a folder.');
    expect(new InvalidFileOperationError('nope').name).toBe('InvalidFileOperationError');
    const originalQuotaError = new Error('full');
    expect(new StorageQuotaExceededError(originalQuotaError).originalError).toBe(
      originalQuotaError,
    );
  });
});

describe('isQuotaExceededError', () => {
  it('recognises a direct QuotaExceededError', () => {
    const quotaError = new Error('full');
    quotaError.name = 'QuotaExceededError';
    expect(isQuotaExceededError(quotaError)).toBe(true);
  });

  it('recognises a Dexie error that wraps a QuotaExceededError', () => {
    const innerQuotaError = new Error('full');
    innerQuotaError.name = 'QuotaExceededError';
    const dexieError = Object.assign(new Error('AbortError'), { inner: innerQuotaError });
    expect(isQuotaExceededError(dexieError)).toBe(true);
  });

  it('ignores other errors and non-errors', () => {
    expect(isQuotaExceededError(new Error('other'))).toBe(false);
    expect(isQuotaExceededError('QuotaExceededError')).toBe(false);
  });
});
