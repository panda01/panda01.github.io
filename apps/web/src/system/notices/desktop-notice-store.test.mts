import { afterEach, describe, expect, it } from 'vitest';
import { StorageQuotaExceededError } from '../fs/file-system-errors.mts';
import { describeFailedAction, useDesktopNoticeStore } from './desktop-notice-store.mts';

afterEach(() => {
  useDesktopNoticeStore.getState().dismissNotice();
});

describe('useDesktopNoticeStore', () => {
  it('shows and dismisses a notice', () => {
    useDesktopNoticeStore.getState().showNotice('Saved.');
    expect(useDesktopNoticeStore.getState().noticeMessage).toBe('Saved.');

    useDesktopNoticeStore.getState().dismissNotice();
    expect(useDesktopNoticeStore.getState().noticeMessage).toBeUndefined();
  });
});

describe('describeFailedAction', () => {
  it('explains a full storage quota', () => {
    expect(
      describeFailedAction('create the folder', new StorageQuotaExceededError(new Error())),
    ).toBe("Couldn't create the folder: Your browser has run out of storage space for this site.");
  });

  it('includes the error message for other errors and handles non-errors', () => {
    expect(describeFailedAction('empty the Trash', new Error('Disk on fire.'))).toBe(
      "Couldn't empty the Trash. Disk on fire.",
    );
    expect(describeFailedAction('reset the desktop', 'unknown')).toBe(
      "Couldn't reset the desktop. unknown",
    );
  });
});
