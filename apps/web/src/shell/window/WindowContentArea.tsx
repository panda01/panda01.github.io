import { memo, Suspense } from 'react';
import type { JSX } from 'react';
import { Box, CircularProgress } from '@mui/material';
import type { AppManifest } from '../../system/app-registry/app-manifest.types.mts';
import { lazyWindowContentByAppId } from './lazy-window-content.mts';
import { WindowErrorBoundary } from './WindowErrorBoundary.tsx';

/** Props for the scrolling area of a window that shows its app's content. */
export interface WindowContentAreaProps {
  /** The window the content belongs to. */
  windowId: string;
  /** The app shown in the window. */
  appManifest: AppManifest;
  /** What the app was opened with (for example a file path), if anything. */
  launchArgument?: string | undefined;
  /** Closes the window (offered when the app crashes). */
  onCloseWindow: () => void;
}

/**
 * The part of a window below the title bar: the app's content, loaded on demand (with a spinner
 * while it loads) and protected by an error boundary.
 * @param props - The window, its app, and how to close it.
 * @param props.windowId - The window the content belongs to.
 * @param props.appManifest - The app shown in the window.
 * @param props.launchArgument - What the app was opened with, if anything.
 * @param props.onCloseWindow - Closes the window.
 * @returns The window's content area.
 */
function WindowContentAreaWithoutMemo({
  windowId,
  appManifest,
  launchArgument,
  onCloseWindow,
}: WindowContentAreaProps): JSX.Element {
  const WindowContent = lazyWindowContentByAppId[appManifest.id];
  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      <WindowErrorBoundary appName={appManifest.displayName} onCloseWindow={onCloseWindow}>
        <Suspense
          fallback={
            <Box sx={{ display: 'grid', placeItems: 'center', p: 4 }}>
              <CircularProgress size={24} aria-label={`Opening ${appManifest.displayName}`} />
            </Box>
          }
        >
          {WindowContent === undefined ? null : (
            <WindowContent
              windowId={windowId}
              {...(launchArgument === undefined ? {} : { launchArgument })}
            />
          )}
        </Suspense>
      </WindowErrorBoundary>
    </Box>
  );
}

/**
 * The window's content area, memoized so it is not re-rendered when only the window's frame changes
 * (for example on every pointer move while the window is dragged).
 */
export const WindowContentArea = memo(WindowContentAreaWithoutMemo);
