import { Suspense, useCallback, useMemo, useRef } from 'react';
import type { JSX } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { motion } from 'motion/react';
import { Rnd } from 'react-rnd';
import type { AppManifest } from '../../system/app-registry/app-manifest.types.mts';
import { useDesktopSession } from '../../system/desktop-session/desktop-session-context.tsx';
import { smallestWindowSize } from '../../system/window-manager/window-geometry.mts';
import type { DesktopWindowState } from '../../system/window-manager/window.types.mts';
import { lazyWindowContentByAppId } from './lazy-window-content.mts';
import { TrafficLights } from './TrafficLights.tsx';
import { useTitleBarDrag } from './use-title-bar-drag.mts';
import type { WindowPosition } from './use-title-bar-drag.mts';
import { createWindowFrameHandlers } from './window-frame-handlers.mts';
import { WindowErrorBoundary } from './WindowErrorBoundary.tsx';

/** Class on every window's title bar (the part you drag the window by). */
export const windowTitleBarClassName = 'window-title-bar';

/** z-index of the bottom-most window; each window above it adds one. */
export const firstWindowZIndex = 10;

/** Props for one desktop window. */
export interface DesktopWindowProps {
  windowState: DesktopWindowState;
  appManifest: AppManifest;
  /** Position in the stacking order (0 is the bottom). */
  stackIndex: number;
  isFocused: boolean;
}

/**
 * One macOS-style window: draggable by its title bar, resizable from every edge, with traffic
 * lights, a centred title, and the app's content (loaded on demand and protected by an error
 * boundary). Pressing anywhere on the window brings it to the front.
 * @param props - The window's state, app, and stacking position.
 * @param props.windowState - Position, size, title and flags of the window.
 * @param props.appManifest - The app shown in the window.
 * @param props.stackIndex - Position in the stacking order.
 * @param props.isFocused - Whether this is the focused window.
 * @returns The window.
 */
export function DesktopWindow({
  windowState,
  appManifest,
  stackIndex,
  isFocused,
}: DesktopWindowProps): JSX.Element {
  const { windowManagerStore } = useDesktopSession();
  const windowFrameHandlers = useMemo(
    () => createWindowFrameHandlers(windowState.id, windowManagerStore),
    [windowState.id, windowManagerStore],
  );
  const WindowContent = lazyWindowContentByAppId[appManifest.id];
  const windowManagerActions = windowManagerStore.getState();
  const windowFrameRef = useRef<Rnd>(null);
  const showDragPosition = useCallback((windowPosition: WindowPosition) => {
    windowFrameRef.current?.updatePosition(windowPosition);
  }, []);
  const titleBarDragHandlers = useTitleBarDrag(
    windowState.id,
    windowManagerStore,
    showDragPosition,
  );

  return (
    <Rnd
      ref={windowFrameRef}
      size={{ width: windowState.bounds.width, height: windowState.bounds.height }}
      position={{ x: windowState.bounds.x, y: windowState.bounds.y }}
      bounds="parent"
      // Title-bar dragging is our own (use-title-bar-drag.mts): react-rnd's could lose movement in Safari.
      disableDragging
      minWidth={smallestWindowSize.width}
      minHeight={smallestWindowSize.height}
      onResizeStart={windowFrameHandlers.handleInteractionStart}
      onResizeStop={windowFrameHandlers.handleResizeStop}
      resizeHandleComponent={{
        bottomRight: (
          <Box
            data-testid="window-resize-handle-bottom-right"
            sx={{ width: '100%', height: '100%' }}
          />
        ),
      }}
      style={{ zIndex: firstWindowZIndex + stackIndex, pointerEvents: 'auto' }}
      role="dialog"
      aria-label={windowState.title}
      data-focused={String(isFocused)}
      onPointerDownCapture={() => {
        windowManagerActions.focusWindow(windowState.id);
      }}
    >
      <motion.div
        style={{ height: '100%' }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.35, y: 240 }}
        transition={{ duration: 0.18 }}
      >
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '10px',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            border: '0.5px solid',
            borderColor: 'divider',
            boxShadow: isFocused
              ? '0 22px 70px rgba(0, 0, 0, 0.45)'
              : '0 10px 30px rgba(0, 0, 0, 0.22)',
          }}
        >
          <Box
            className={windowTitleBarClassName}
            data-testid="window-title-bar"
            {...titleBarDragHandlers}
            onDoubleClick={() => {
              windowManagerActions.toggleWindowZoom(windowState.id);
            }}
            sx={{
              position: 'relative',
              flexShrink: 0,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              px: 1.5,
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            <TrafficLights
              isWindowFocused={isFocused}
              onClose={() => {
                windowManagerActions.closeWindow(windowState.id);
              }}
              onMinimize={() => {
                windowManagerActions.minimizeWindow(windowState.id);
              }}
              onZoom={() => {
                windowManagerActions.toggleWindowZoom(windowState.id);
              }}
            />
            <Typography
              component="span"
              sx={{
                position: 'absolute',
                left: 80,
                right: 80,
                textAlign: 'center',
                pointerEvents: 'none',
                fontSize: 13,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: isFocused ? 'text.primary' : 'text.secondary',
              }}
            >
              {windowState.title}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <WindowErrorBoundary
              appName={appManifest.displayName}
              onCloseWindow={() => {
                windowManagerActions.closeWindow(windowState.id);
              }}
            >
              <Suspense
                fallback={
                  <Box sx={{ display: 'grid', placeItems: 'center', p: 4 }}>
                    <CircularProgress size={24} aria-label={`Opening ${appManifest.displayName}`} />
                  </Box>
                }
              >
                {WindowContent === undefined ? null : (
                  <WindowContent
                    windowId={windowState.id}
                    {...(windowState.launchArgument === undefined
                      ? {}
                      : { launchArgument: windowState.launchArgument })}
                  />
                )}
              </Suspense>
            </WindowErrorBoundary>
          </Box>
        </Box>
      </motion.div>
    </Rnd>
  );
}
