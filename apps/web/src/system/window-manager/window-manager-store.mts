import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { createRandomItemId } from '../fs/virtual-file-system.mts';
import {
  clampWindowBoundsToDesktopArea,
  computeCascadedWindowBounds,
  computeZoomedWindowBounds,
} from './window-geometry.mts';
import type {
  DesktopAreaSize,
  DesktopWindowState,
  PersistedWindowRecord,
  WindowBounds,
} from './window.types.mts';

/** Whether the shell shows overlapping windows (desktop) or one full-screen app at a time (touch). */
export type InterfaceMode = 'desktop' | 'touch';

/** What an app asks for when it wants a window. */
export interface OpenWindowRequest {
  appId: string;
  title: string;
  defaultSize: { width: number; height: number };
  /** App-specific input, for example the path a Get Info window describes. */
  launchArgument?: string;
  /**
   * Single-window apps (false) always reuse their window. Multi-window apps (true) reuse the window
   * with the same launch argument, or open a new one when there is no launch argument.
   */
  allowsMultipleWindows: boolean;
}

/** The window manager's state and the actions that change it. */
export interface WindowManagerState {
  windowsById: Readonly<Record<string, DesktopWindowState>>;
  /** Window ids from bottom to top; the last visible one is focused. */
  windowStackOrder: readonly string[];
  desktopAreaSize: DesktopAreaSize;
  interfaceMode: InterfaceMode;
  openWindow: (openWindowRequest: OpenWindowRequest) => string;
  closeWindow: (windowId: string) => void;
  closeAllWindowsOfApp: (appId: string) => void;
  focusWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  toggleWindowZoom: (windowId: string) => void;
  moveWindow: (windowId: string, newPosition: { x: number; y: number }) => void;
  resizeWindow: (windowId: string, newBounds: WindowBounds) => void;
  updateWindowTitleAndLaunchArgument: (
    windowId: string,
    newTitle: string,
    newLaunchArgument: string,
  ) => void;
  setDesktopAreaSize: (newDesktopAreaSize: DesktopAreaSize) => void;
  replaceAllWindows: (persistedWindows: readonly PersistedWindowRecord[]) => void;
  setInterfaceMode: (newInterfaceMode: InterfaceMode) => void;
}

/** A window manager store instance (one per desktop). */
export type WindowManagerStore = StoreApi<WindowManagerState>;

/**
 * Creates the window manager store.
 * @param initialDesktopAreaSize - Size of the area below the menu bar when the desktop starts.
 * @param createWindowId - Produces unique window ids (replaceable in tests).
 * @returns A new store with no windows open.
 */
export function createWindowManagerStore(
  initialDesktopAreaSize: DesktopAreaSize,
  createWindowId: () => string = () => `window-${createRandomItemId()}`,
): WindowManagerStore {
  return createStore<WindowManagerState>()((setState, getState) => {
    /**
     * Applies a change to one window if it exists.
     * @param windowId - The window to change.
     * @param changeWindow - Returns the window's new state.
     */
    function updateWindow(
      windowId: string,
      changeWindow: (currentWindow: DesktopWindowState) => DesktopWindowState,
    ): void {
      const currentWindow = getState().windowsById[windowId];
      if (currentWindow === undefined) {
        return;
      }
      setState({
        windowsById: { ...getState().windowsById, [windowId]: changeWindow(currentWindow) },
      });
    }

    /**
     * Moves a window to the top of the stack.
     * @param windowId - The window to raise.
     */
    function raiseWindowToTop(windowId: string): void {
      const isUnknownWindow = getState().windowsById[windowId] === undefined;
      // Already on top: changing nothing avoids re-rendering every window on each click.
      const isAlreadyOnTop = getState().windowStackOrder.at(-1) === windowId;
      if (isUnknownWindow || isAlreadyOnTop) {
        return;
      }
      const otherWindowIds = getState().windowStackOrder.filter(
        (stackedId) => stackedId !== windowId,
      );
      setState({ windowStackOrder: [...otherWindowIds, windowId] });
    }

    /**
     * Removes windows from the state and the stack.
     * @param windowIdsToRemove - Ids of the windows to remove.
     */
    function removeWindows(windowIdsToRemove: readonly string[]): void {
      const remainingWindows = Object.fromEntries(
        Object.entries(getState().windowsById).filter(
          ([windowId]) => !windowIdsToRemove.includes(windowId),
        ),
      );
      setState({
        windowsById: remainingWindows,
        windowStackOrder: getState().windowStackOrder.filter(
          (stackedId) => !windowIdsToRemove.includes(stackedId),
        ),
      });
    }

    return {
      windowsById: {},
      windowStackOrder: [],
      desktopAreaSize: initialDesktopAreaSize,
      interfaceMode: 'desktop',

      /**
       * Opens a window for an app, or brings back the app's existing matching window. A
       * single-window app asked to show something new (for example Quick Look and another file)
       * switches its window to the new launch argument and title.
       * @param openWindowRequest - Which app, title, size and launch argument.
       * @returns The id of the opened (or reused) window.
       */
      openWindow: (openWindowRequest) => {
        const existingWindow = Object.values(getState().windowsById).find((openWindow) =>
          isSameWindowRequest(openWindow, openWindowRequest),
        );
        if (existingWindow !== undefined) {
          const requestedLaunchArgument = openWindowRequest.launchArgument;
          const isNewLaunchArgument =
            requestedLaunchArgument !== undefined &&
            requestedLaunchArgument !== existingWindow.launchArgument;
          if (isNewLaunchArgument) {
            getState().updateWindowTitleAndLaunchArgument(
              existingWindow.id,
              openWindowRequest.title,
              requestedLaunchArgument,
            );
          }
          getState().restoreWindow(existingWindow.id);
          return existingWindow.id;
        }

        const newWindowId = createWindowId();
        const numberOfVisibleWindows = Object.values(getState().windowsById).filter(
          (openWindow) => !openWindow.isMinimized,
        ).length;
        const newWindow: DesktopWindowState = {
          id: newWindowId,
          appId: openWindowRequest.appId,
          title: openWindowRequest.title,
          bounds: computeCascadedWindowBounds(
            openWindowRequest.defaultSize,
            getState().desktopAreaSize,
            numberOfVisibleWindows,
          ),
          isMinimized: false,
          isZoomed: false,
          ...(openWindowRequest.launchArgument === undefined
            ? {}
            : { launchArgument: openWindowRequest.launchArgument }),
        };
        setState({
          windowsById: { ...getState().windowsById, [newWindowId]: newWindow },
          windowStackOrder: [...getState().windowStackOrder, newWindowId],
        });
        return newWindowId;
      },

      /**
       * Closes one window.
       * @param windowId - The window to close.
       */
      closeWindow: (windowId) => {
        removeWindows([windowId]);
      },

      /**
       * Closes every window of an app (what "Quit" does).
       * @param appId - The app to quit.
       */
      closeAllWindowsOfApp: (appId) => {
        removeWindows(
          Object.values(getState().windowsById)
            .filter((openWindow) => openWindow.appId === appId)
            .map((openWindow) => openWindow.id),
        );
      },

      /**
       * Brings a window to the front.
       * @param windowId - The window to focus.
       */
      focusWindow: (windowId) => {
        raiseWindowToTop(windowId);
      },

      /**
       * Minimizes a window into the Dock.
       * @param windowId - The window to minimize.
       */
      minimizeWindow: (windowId) => {
        updateWindow(windowId, (currentWindow) => ({ ...currentWindow, isMinimized: true }));
      },

      /**
       * Brings a minimized window back from the Dock and focuses it.
       * @param windowId - The window to restore.
       */
      restoreWindow: (windowId) => {
        updateWindow(windowId, (currentWindow) => ({ ...currentWindow, isMinimized: false }));
        raiseWindowToTop(windowId);
      },

      /**
       * Zooms a window to fill the screen above the Dock, or returns it to its previous size.
       * @param windowId - The window to zoom or un-zoom.
       */
      toggleWindowZoom: (windowId) => {
        updateWindow(windowId, (currentWindow) => {
          if (currentWindow.isZoomed) {
            const unzoomedWindow: DesktopWindowState = {
              ...currentWindow,
              isZoomed: false,
              bounds: clampWindowBoundsToDesktopArea(
                currentWindow.boundsBeforeZoom ?? currentWindow.bounds,
                getState().desktopAreaSize,
              ),
            };
            delete unzoomedWindow.boundsBeforeZoom;
            return unzoomedWindow;
          }
          return {
            ...currentWindow,
            isZoomed: true,
            boundsBeforeZoom: currentWindow.bounds,
            bounds: computeZoomedWindowBounds(getState().desktopAreaSize),
          };
        });
        raiseWindowToTop(windowId);
      },

      /**
       * Moves a window (after a title-bar drag), keeping it below the menu bar and on screen.
       * @param windowId - The window to move.
       * @param newPosition - The new top-left corner.
       */
      moveWindow: (windowId, newPosition) => {
        updateWindow(windowId, (currentWindow) =>
          leaveZoomedState(
            currentWindow,
            { ...currentWindow.bounds, ...newPosition },
            getState().desktopAreaSize,
          ),
        );
      },

      /**
       * Resizes a window (after an edge or corner drag), keeping it on screen.
       * @param windowId - The window to resize.
       * @param newBounds - The new position and size.
       */
      resizeWindow: (windowId, newBounds) => {
        updateWindow(windowId, (currentWindow) =>
          leaveZoomedState(currentWindow, newBounds, getState().desktopAreaSize),
        );
      },

      /**
       * Changes what a window shows, for example when a Finder window navigates to another folder,
       * so its title and saved location stay current (and survive a reload).
       * @param windowId - The window to change.
       * @param newTitle - The new title bar text.
       * @param newLaunchArgument - The new app-specific input, for example the folder path.
       */
      updateWindowTitleAndLaunchArgument: (windowId, newTitle, newLaunchArgument) => {
        const currentWindow = getState().windowsById[windowId];
        const isAlreadyShowingThis =
          currentWindow?.title === newTitle && currentWindow.launchArgument === newLaunchArgument;
        if (isAlreadyShowingThis) {
          return;
        }
        updateWindow(windowId, (windowToChange) => ({
          ...windowToChange,
          title: newTitle,
          launchArgument: newLaunchArgument,
        }));
      },

      /**
       * Records a new screen size and pulls windows back into view if it shrank.
       * @param newDesktopAreaSize - The size of the area below the menu bar.
       */
      setDesktopAreaSize: (newDesktopAreaSize) => {
        const refittedWindows = Object.fromEntries(
          Object.entries(getState().windowsById).map(([windowId, openWindow]) => [
            windowId,
            {
              ...openWindow,
              bounds: openWindow.isZoomed
                ? computeZoomedWindowBounds(newDesktopAreaSize)
                : clampWindowBoundsToDesktopArea(openWindow.bounds, newDesktopAreaSize),
            },
          ]),
        );
        setState({ desktopAreaSize: newDesktopAreaSize, windowsById: refittedWindows });
      },

      /**
       * Replaces all windows with a saved layout (used when the desktop starts).
       * @param persistedWindows - The saved windows.
       */
      replaceAllWindows: (persistedWindows) => {
        const windowsInStackOrder = [...persistedWindows].sort(
          (firstWindow, secondWindow) => firstWindow.stackPosition - secondWindow.stackPosition,
        );
        const restoredWindowsById: Record<string, DesktopWindowState> = {};
        for (const persistedWindow of windowsInStackOrder) {
          restoredWindowsById[persistedWindow.id] = {
            ...toDesktopWindowState(persistedWindow),
            bounds: clampWindowBoundsToDesktopArea(
              persistedWindow.bounds,
              getState().desktopAreaSize,
            ),
          };
        }
        setState({
          windowsById: restoredWindowsById,
          windowStackOrder: windowsInStackOrder.map((persistedWindow) => persistedWindow.id),
        });
      },

      /**
       * Switches between the overlapping-window desktop and the one-app-at-a-time touch layout.
       * @param newInterfaceMode - The layout to use.
       */
      setInterfaceMode: (newInterfaceMode) => {
        setState({ interfaceMode: newInterfaceMode });
      },
    };
  });
}

/**
 * Decides whether an open window already satisfies a request to open a window.
 * @param openWindow - A window that is already open.
 * @param openWindowRequest - The new request.
 * @returns True when the request should reuse this window.
 */
function isSameWindowRequest(
  openWindow: DesktopWindowState,
  openWindowRequest: OpenWindowRequest,
): boolean {
  if (openWindow.appId !== openWindowRequest.appId) {
    return false;
  }
  if (!openWindowRequest.allowsMultipleWindows) {
    return true;
  }
  return (
    openWindowRequest.launchArgument !== undefined &&
    openWindow.launchArgument === openWindowRequest.launchArgument
  );
}

/**
 * Applies new bounds after a drag or resize; a zoomed window stops being zoomed, like on macOS.
 * @param currentWindow - The window being moved or resized.
 * @param requestedBounds - The bounds the user dragged to.
 * @param desktopAreaSize - The size of the area below the menu bar.
 * @returns The updated window.
 */
function leaveZoomedState(
  currentWindow: DesktopWindowState,
  requestedBounds: WindowBounds,
  desktopAreaSize: DesktopAreaSize,
): DesktopWindowState {
  const movedWindow: DesktopWindowState = {
    ...currentWindow,
    isZoomed: false,
    bounds: clampWindowBoundsToDesktopArea(requestedBounds, desktopAreaSize),
  };
  delete movedWindow.boundsBeforeZoom;
  return movedWindow;
}

/**
 * Copies the window fields out of a persisted record (dropping its stack position).
 * @param persistedWindow - A window as stored in IndexedDB.
 * @returns The window state the store keeps.
 */
function toDesktopWindowState(persistedWindow: PersistedWindowRecord): DesktopWindowState {
  return {
    id: persistedWindow.id,
    appId: persistedWindow.appId,
    title: persistedWindow.title,
    bounds: persistedWindow.bounds,
    isMinimized: persistedWindow.isMinimized,
    isZoomed: persistedWindow.isZoomed,
    ...(persistedWindow.launchArgument === undefined
      ? {}
      : { launchArgument: persistedWindow.launchArgument }),
    ...(persistedWindow.boundsBeforeZoom === undefined
      ? {}
      : { boundsBeforeZoom: persistedWindow.boundsBeforeZoom }),
  };
}

/**
 * Lists the open windows from bottom to top.
 * @param windowManagerState - The current state.
 * @returns The windows in stacking order.
 */
export function selectWindowsInStackOrder(
  windowManagerState: WindowManagerState,
): DesktopWindowState[] {
  return windowManagerState.windowStackOrder.flatMap((windowId) => {
    const stackedWindow = windowManagerState.windowsById[windowId];
    return stackedWindow === undefined ? [] : [stackedWindow];
  });
}

/**
 * Lists the open windows in the order they were opened. Rendering in this stable order (and
 * stacking with z-index) means focusing a window never moves its element in the page, which would
 * otherwise reload any iframe inside it (such as the Browser's stream in Phase 4).
 * @param windowManagerState - The current state.
 * @returns The windows, oldest first.
 */
export function selectWindowsInOpeningOrder(
  windowManagerState: WindowManagerState,
): DesktopWindowState[] {
  return Object.values(windowManagerState.windowsById);
}

/**
 * Finds the focused window: the top-most window that is not minimized.
 * @param windowManagerState - The current state.
 * @returns The focused window, or undefined when every window is closed or minimized.
 */
export function selectFocusedWindow(
  windowManagerState: WindowManagerState,
): DesktopWindowState | undefined {
  return selectWindowsInStackOrder(windowManagerState).findLast(
    (stackedWindow) => !stackedWindow.isMinimized,
  );
}

/**
 * Finds an app's front-most window (minimized or not), for example to bring Finder forward when
 * its Dock icon is clicked.
 * @param windowManagerState - The current state.
 * @param appId - The app whose window to find.
 * @returns The app's highest window in the stack, or undefined when the app has no windows.
 */
export function selectTopmostWindowOfApp(
  windowManagerState: WindowManagerState,
  appId: string,
): DesktopWindowState | undefined {
  return selectWindowsInStackOrder(windowManagerState).findLast(
    (stackedWindow) => stackedWindow.appId === appId,
  );
}

/**
 * Finds the app that owns the focused window.
 * @param windowManagerState - The current state.
 * @returns The focused app's id, or undefined when no window is focused.
 */
export function selectFocusedAppId(windowManagerState: WindowManagerState): string | undefined {
  return selectFocusedWindow(windowManagerState)?.appId;
}
