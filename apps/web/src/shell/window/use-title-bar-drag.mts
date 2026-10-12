import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { clampWindowBoundsToDesktopArea } from '../../system/window-manager/window-geometry.mts';
import type { WindowManagerStore } from '../../system/window-manager/window-manager-store.mts';
import type { DesktopAreaSize, WindowBounds } from '../../system/window-manager/window.types.mts';
import { trafficLightClassName } from './TrafficLights.tsx';

/** Where a title-bar drag started: the pointer and the window's top-left corner. */
export interface TitleBarDragStart {
  startPointerX: number;
  startPointerY: number;
  startWindowX: number;
  startWindowY: number;
}

/** A window position (top-left corner) within the desktop area. */
export interface WindowPosition {
  x: number;
  y: number;
}

/** Pointer handlers to attach to a window's title bar. */
export interface TitleBarDragHandlers {
  onPointerDown: (pointerEvent: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (pointerEvent: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (pointerEvent: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (pointerEvent: ReactPointerEvent<HTMLElement>) => void;
}

/** An in-progress drag: which pointer, where it started, and where the window is now. */
interface ActiveTitleBarDrag extends TitleBarDragStart {
  pointerId: number;
  latestPosition: WindowPosition;
}

/**
 * Computes where a dragged window belongs: its starting position plus the pointer's total movement
 * since the drag began, kept inside the desktop area. Because every move is computed from the start
 * (not added to the previous move), a skipped or merged pointer event can never make the window
 * fall behind the cursor.
 * @param dragStart - Where the pointer and window were when the drag began.
 * @param pointerX - The pointer's current horizontal position.
 * @param pointerY - The pointer's current vertical position.
 * @param windowBounds - The window's current bounds (its size is kept).
 * @param desktopAreaSize - The area below the menu bar.
 * @returns The window's new top-left corner.
 */
export function computeDraggedWindowPosition(
  dragStart: TitleBarDragStart,
  pointerX: number,
  pointerY: number,
  windowBounds: WindowBounds,
  desktopAreaSize: DesktopAreaSize,
): WindowPosition {
  const clampedBounds = clampWindowBoundsToDesktopArea(
    {
      x: dragStart.startWindowX + (pointerX - dragStart.startPointerX),
      y: dragStart.startWindowY + (pointerY - dragStart.startPointerY),
      width: windowBounds.width,
      height: windowBounds.height,
    },
    desktopAreaSize,
  );
  return { x: clampedBounds.x, y: clampedBounds.y };
}

/**
 * Lets the visitor drag a window by its title bar. While dragging, the window is moved directly
 * (through `showDragPosition`) on every pointer move; the final position is saved to the window
 * manager once, when the pointer is released, and only if the window actually moved (so a click or
 * double-click never un-zooms a zoomed window).
 * @param windowId - The window being dragged.
 * @param windowManagerStore - The window manager.
 * @param showDragPosition - Moves the window on screen during the drag.
 * @returns Pointer handlers for the title bar.
 */
export function useTitleBarDrag(
  windowId: string,
  windowManagerStore: WindowManagerStore,
  showDragPosition: (windowPosition: WindowPosition) => void,
): TitleBarDragHandlers {
  const activeDragRef = useRef<ActiveTitleBarDrag | null>(null);

  // Starts a drag on a primary-button press that did not begin on a traffic-light button.
  const handlePointerDown = useCallback(
    (pointerEvent: ReactPointerEvent<HTMLElement>) => {
      const isPrimaryButtonPress = pointerEvent.button === 0 && pointerEvent.isPrimary;
      const didPressStartOnTrafficLight =
        pointerEvent.target instanceof Element &&
        pointerEvent.target.closest(`.${trafficLightClassName}`) !== null;
      const draggedWindow = windowManagerStore.getState().windowsById[windowId];
      if (!isPrimaryButtonPress || didPressStartOnTrafficLight || draggedWindow === undefined) {
        return;
      }
      pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
      activeDragRef.current = {
        pointerId: pointerEvent.pointerId,
        startPointerX: pointerEvent.clientX,
        startPointerY: pointerEvent.clientY,
        startWindowX: draggedWindow.bounds.x,
        startWindowY: draggedWindow.bounds.y,
        latestPosition: { x: draggedWindow.bounds.x, y: draggedWindow.bounds.y },
      };
    },
    [windowId, windowManagerStore],
  );

  // Moves the window to follow the pointer during a drag.
  const handlePointerMove = useCallback(
    (pointerEvent: ReactPointerEvent<HTMLElement>) => {
      const activeDrag = activeDragRef.current;
      const windowManagerState = windowManagerStore.getState();
      const draggedWindow = windowManagerState.windowsById[windowId];
      const isMoveOfActiveDrag = activeDrag?.pointerId === pointerEvent.pointerId;
      if (!isMoveOfActiveDrag || draggedWindow === undefined) {
        return;
      }
      activeDrag.latestPosition = computeDraggedWindowPosition(
        activeDrag,
        pointerEvent.clientX,
        pointerEvent.clientY,
        draggedWindow.bounds,
        windowManagerState.desktopAreaSize,
      );
      showDragPosition(activeDrag.latestPosition);
    },
    [windowId, windowManagerStore, showDragPosition],
  );

  // Ends a drag (pointer released or cancelled) and saves where the window ended up.
  const finishDrag = useCallback(
    (pointerEvent: ReactPointerEvent<HTMLElement>) => {
      const activeDrag = activeDragRef.current;
      if (activeDrag?.pointerId !== pointerEvent.pointerId) {
        return;
      }
      activeDragRef.current = null;
      if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) {
        pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId);
      }
      const didWindowMove =
        activeDrag.latestPosition.x !== activeDrag.startWindowX ||
        activeDrag.latestPosition.y !== activeDrag.startWindowY;
      if (didWindowMove) {
        windowManagerStore.getState().moveWindow(windowId, activeDrag.latestPosition);
      }
    },
    [windowId, windowManagerStore],
  );

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
  };
}
