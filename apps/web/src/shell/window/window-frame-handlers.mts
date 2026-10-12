import type { WindowManagerStore } from '../../system/window-manager/window-manager-store.mts';
import type { WindowBounds } from '../../system/window-manager/window.types.mts';

/** Event handlers connecting the resizable window frame (react-rnd) to the window manager. */
export interface WindowFrameHandlers {
  handleInteractionStart: () => void;
  handleResizeStop: (
    resizeEvent: unknown,
    resizeDirection: unknown,
    resizedElement: HTMLElement,
    resizeDelta: unknown,
    resizedPosition: { x: number; y: number },
  ) => void;
}

/**
 * Creates the frame handlers for one window: starting a resize focuses it, and finishing a resize
 * saves the new bounds in the window manager (which keeps them on screen). Title-bar dragging is
 * handled separately by use-title-bar-drag.mts.
 * @param windowId - The window the frame belongs to.
 * @param windowManagerStore - The window manager.
 * @returns The handlers to pass to the frame.
 */
export function createWindowFrameHandlers(
  windowId: string,
  windowManagerStore: WindowManagerStore,
): WindowFrameHandlers {
  /**
   * Focuses the window when a resize begins.
   */
  function handleInteractionStart(): void {
    windowManagerStore.getState().focusWindow(windowId);
  }

  /**
   * Reads the window's current bounds.
   * @returns The bounds, or undefined if the window has closed.
   */
  function readCurrentBounds(): WindowBounds | undefined {
    return windowManagerStore.getState().windowsById[windowId]?.bounds;
  }

  /**
   * Saves the bounds an edge or corner drag ended at.
   * @param _resizeEvent - The resize event (unused).
   * @param _resizeDirection - Which edge was dragged (unused).
   * @param resizedElement - The window frame element, already at its new size.
   * @param _resizeDelta - How much the size changed (unused).
   * @param resizedPosition - The frame's new top-left corner.
   * @param resizedPosition.x - New left edge.
   * @param resizedPosition.y - New top edge.
   */
  function handleResizeStop(
    _resizeEvent: unknown,
    _resizeDirection: unknown,
    resizedElement: HTMLElement,
    _resizeDelta: unknown,
    resizedPosition: { x: number; y: number },
  ): void {
    const resizedBounds: WindowBounds = {
      x: resizedPosition.x,
      y: resizedPosition.y,
      width: resizedElement.offsetWidth,
      height: resizedElement.offsetHeight,
    };
    const currentBounds = readCurrentBounds();
    const didWindowResize =
      currentBounds?.x !== resizedBounds.x ||
      currentBounds.y !== resizedBounds.y ||
      currentBounds.width !== resizedBounds.width ||
      currentBounds.height !== resizedBounds.height;
    if (didWindowResize) {
      windowManagerStore.getState().resizeWindow(windowId, resizedBounds);
    }
  }

  return { handleInteractionStart, handleResizeStop };
}
