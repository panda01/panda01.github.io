import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Box } from '@mui/material';
import { useDesktopSession } from '../system/desktop-session/desktop-session-context.tsx';
import {
  describeFailedAction,
  useDesktopNoticeStore,
} from '../system/notices/desktop-notice-store.mts';
import { menuBarHeightInPixels } from '../system/window-manager/window-geometry.mts';
import { BootScreen } from './boot/BootScreen.tsx';
import { DesktopNoticeSnackbar } from './desktop/DesktopNoticeSnackbar.tsx';
import { DesktopSurface } from './desktop/DesktopSurface.tsx';
import { ResetDesktopDialog } from './desktop/ResetDesktopDialog.tsx';
import { Wallpaper } from './desktop/Wallpaper.tsx';
import { Dock } from './dock/Dock.tsx';
import { useDesktopKeyboardShortcuts } from './keyboard/use-desktop-keyboard-shortcuts.mts';
import { useFullScreenState } from './keyboard/use-full-screen-state.mts';
import { MenuBar } from './menu-bar/MenuBar.tsx';
import { WindowLayer } from './window/WindowLayer.tsx';

/** Notice shown when the browser refuses storage and the desktop lives only in memory. */
export const storageUnavailableNotice =
  'Your browser is not letting this site save data, so your changes will be lost when you leave.';

/**
 * The running desktop: wallpaper, menu bar, desktop icons, windows and Dock, plus keyboard
 * shortcuts, the reset flow, and notices.
 * @returns The desktop.
 */
export function DesktopShell(): JSX.Element {
  const desktopSession = useDesktopSession();
  const showNotice = useDesktopNoticeStore((noticeState) => noticeState.showNotice);
  const fullScreenControls = useFullScreenState();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  useDesktopKeyboardShortcuts(fullScreenControls.isKeyboardLocked);

  useEffect(() => {
    if (!desktopSession.isStoredInBrowser) {
      showNotice(storageUnavailableNotice);
    }
  }, [desktopSession.isStoredInBrowser, showNotice]);

  /**
   * Resets the desktop behind the boot screen, then shows the fresh desktop.
   */
  function resetDesktopToDefault(): void {
    setIsResetDialogOpen(false);
    setIsResetting(true);
    desktopSession
      .resetToDefaultDesktop()
      .catch((resetError: unknown) => {
        showNotice(describeFailedAction('reset the desktop', resetError));
      })
      .finally(() => {
        setIsResetting(false);
      });
  }

  return (
    <Box sx={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <Wallpaper />
      <MenuBar
        fullScreenControls={fullScreenControls}
        onRequestDesktopReset={() => {
          setIsResetDialogOpen(true);
        }}
      />
      <Box
        component="main"
        aria-label="khalah.com desktop"
        sx={{ position: 'absolute', top: menuBarHeightInPixels, left: 0, right: 0, bottom: 0 }}
      >
        <DesktopSurface />
        <WindowLayer />
        <Dock />
      </Box>
      <ResetDesktopDialog
        isOpen={isResetDialogOpen}
        onCancel={() => {
          setIsResetDialogOpen(false);
        }}
        onConfirmReset={resetDesktopToDefault}
      />
      <DesktopNoticeSnackbar />
      {isResetting ? <BootScreen /> : null}
    </Box>
  );
}
