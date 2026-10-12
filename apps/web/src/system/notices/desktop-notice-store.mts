import { create } from 'zustand';
import { StorageQuotaExceededError } from '../fs/file-system-errors.mts';

/** A short message shown at the bottom of the desktop (for example after a failed file action). */
export interface DesktopNoticeState {
  noticeMessage: string | undefined;
  showNotice: (noticeMessage: string) => void;
  dismissNotice: () => void;
}

/** Global store for the single desktop notice. */
export const useDesktopNoticeStore = create<DesktopNoticeState>()((setState) => ({
  noticeMessage: undefined,
  /**
   * Shows a notice, replacing any notice already shown.
   * @param noticeMessage - The text to show.
   */
  showNotice: (noticeMessage) => {
    setState({ noticeMessage });
  },
  /**
   * Hides the current notice.
   */
  dismissNotice: () => {
    setState({ noticeMessage: undefined });
  },
}));

/**
 * Turns an error from a desktop action into a message a visitor can understand.
 * @param actionDescription - What the visitor tried to do, for example "create the folder".
 * @param caughtError - The error that was thrown.
 * @returns The message to show.
 */
export function describeFailedAction(actionDescription: string, caughtError: unknown): string {
  if (caughtError instanceof StorageQuotaExceededError) {
    return `Couldn't ${actionDescription}: ${caughtError.message}`;
  }
  const errorDetail = caughtError instanceof Error ? caughtError.message : String(caughtError);
  return `Couldn't ${actionDescription}. ${errorDetail}`;
}
