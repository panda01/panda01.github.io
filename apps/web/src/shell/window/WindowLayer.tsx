import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { Box } from '@mui/material';
import { AnimatePresence } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { findAppManifest } from '../../system/app-registry/app-registry.mts';
import {
  useDesktopSession,
  useWindowManager,
} from '../../system/desktop-session/desktop-session-context.tsx';
import {
  selectFocusedWindow,
  selectWindowsInOpeningOrder,
} from '../../system/window-manager/window-manager-store.mts';
import { DesktopWindow } from './DesktopWindow.tsx';

/**
 * The layer that holds every open window. Windows are rendered in the order they were opened and
 * stacked by z-index, so focusing one never moves it in the page. The layer fills the desktop area below
 * the menu bar, reports that area's size to the window manager, and lets clicks on empty space fall
 * through to the desktop underneath.
 * @returns The window layer.
 */
export function WindowLayer(): JSX.Element {
  const { windowManagerStore } = useDesktopSession();
  const openWindows = useWindowManager(useShallow(selectWindowsInOpeningOrder));
  const windowStackOrder = useWindowManager(
    (windowManagerState) => windowManagerState.windowStackOrder,
  );
  const focusedWindowId = useWindowManager(
    (windowManagerState) => selectFocusedWindow(windowManagerState)?.id,
  );
  const windowLayerElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const windowLayerElement = windowLayerElementRef.current;
    if (windowLayerElement === null) {
      return undefined;
    }
    const desktopAreaObserver = new ResizeObserver((observedEntries) => {
      const observedArea = observedEntries[0]?.contentRect;
      const hasUsableSize =
        observedArea !== undefined && observedArea.width > 0 && observedArea.height > 0;
      if (hasUsableSize) {
        windowManagerStore
          .getState()
          .setDesktopAreaSize({ width: observedArea.width, height: observedArea.height });
      }
    });
    desktopAreaObserver.observe(windowLayerElement);
    return () => {
      desktopAreaObserver.disconnect();
    };
  }, [windowManagerStore]);

  return (
    <Box ref={windowLayerElementRef} sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <AnimatePresence>
        {openWindows.map((openWindow) => {
          const appManifest = findAppManifest(openWindow.appId);
          const shouldShowWindow = !openWindow.isMinimized && appManifest !== undefined;
          return shouldShowWindow ? (
            <DesktopWindow
              key={openWindow.id}
              windowState={openWindow}
              appManifest={appManifest}
              stackIndex={windowStackOrder.indexOf(openWindow.id)}
              isFocused={openWindow.id === focusedWindowId}
            />
          ) : null;
        })}
      </AnimatePresence>
    </Box>
  );
}
