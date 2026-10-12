import type { JSX } from 'react';
import { Snackbar } from '@mui/material';
import { useDesktopNoticeStore } from '../../system/notices/desktop-notice-store.mts';

/** How long a notice stays visible, in milliseconds. */
export const noticeVisibleDurationInMilliseconds = 8000;

/**
 * Shows the current desktop notice (for example a failed file action) at the bottom of the screen.
 * @returns The snackbar.
 */
export function DesktopNoticeSnackbar(): JSX.Element {
  const noticeMessage = useDesktopNoticeStore((noticeState) => noticeState.noticeMessage);
  const dismissNotice = useDesktopNoticeStore((noticeState) => noticeState.dismissNotice);
  return (
    <Snackbar
      open={noticeMessage !== undefined}
      message={noticeMessage}
      autoHideDuration={noticeVisibleDurationInMilliseconds}
      onClose={dismissNotice}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    />
  );
}
