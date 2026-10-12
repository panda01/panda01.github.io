import type { JSX } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { MotionConfig } from 'motion/react';
import { DesktopBootGate } from './shell/boot/DesktopBootGate.tsx';
import { RootErrorBoundary } from './shell/boot/RootErrorBoundary.tsx';
import { deleteSavedDesktop } from './system/storage/delete-saved-desktop.mts';
import { createDesktopTheme } from './system/theme/desktop-theme.mts';

const desktopTheme = createDesktopTheme();

/**
 * Reloads the page.
 */
export function reloadPage(): void {
  window.location.reload();
}

/**
 * Deletes the visitor's saved desktop, then reloads so a fresh default desktop is created.
 */
export function deleteSavedDesktopAndReload(): void {
  deleteSavedDesktop()
    .catch((deleteError: unknown) => {
      console.error('Could not delete the saved desktop.', deleteError);
    })
    .finally(reloadPage);
}

/**
 * Root of the khalah.com web desktop: theme (following the visitor's light/dark setting), reduced
 * motion support, crash recovery, and the boot sequence that leads to the desktop.
 * @returns The application.
 */
export function App(): JSX.Element {
  return (
    <ThemeProvider theme={desktopTheme}>
      <CssBaseline />
      <MotionConfig reducedMotion="user">
        <RootErrorBoundary onReload={reloadPage} onResetDesktop={deleteSavedDesktopAndReload}>
          <DesktopBootGate onReload={reloadPage} onResetDesktop={deleteSavedDesktopAndReload} />
        </RootErrorBoundary>
      </MotionConfig>
    </ThemeProvider>
  );
}
