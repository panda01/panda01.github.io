import { createContext, useCallback, useContext } from 'react';
import type { JSX, ReactNode } from 'react';
import { useStore } from 'zustand';
import { buildOpenWindowRequest, findAppManifest } from '../app-registry/app-registry.mts';
import { selectTopmostWindowOfApp } from '../window-manager/window-manager-store.mts';
import type { WindowManagerState } from '../window-manager/window-manager-store.mts';
import type { DesktopSession } from './desktop-session.mts';

const DesktopSessionContext = createContext<DesktopSession | undefined>(undefined);

/**
 * Makes the running desktop session available to every component below it.
 * @param props - The session and the components that use it.
 * @param props.desktopSession - The running session.
 * @param props.children - Components that use the session.
 * @returns The provider element.
 */
export function DesktopSessionProvider({
  desktopSession,
  children,
}: {
  desktopSession: DesktopSession;
  children: ReactNode;
}): JSX.Element {
  return (
    <DesktopSessionContext.Provider value={desktopSession}>
      {children}
    </DesktopSessionContext.Provider>
  );
}

/**
 * Reads the running desktop session.
 * @returns The session (database, filesystem, window manager).
 * @throws {Error} When used outside a DesktopSessionProvider.
 */
export function useDesktopSession(): DesktopSession {
  const desktopSession = useContext(DesktopSessionContext);
  if (desktopSession === undefined) {
    throw new Error('useDesktopSession must be used inside a DesktopSessionProvider.');
  }
  return desktopSession;
}

/**
 * Subscribes to part of the window manager state; the component re-renders only when that part
 * changes. Selectors that build new arrays or objects must be wrapped in `useShallow`.
 * @param selectState - Picks the needed part of the state.
 * @returns The selected value.
 */
export function useWindowManager<SelectedState>(
  selectState: (windowManagerState: WindowManagerState) => SelectedState,
): SelectedState {
  return useStore(useDesktopSession().windowManagerStore, selectState);
}

/**
 * Returns a function that opens an app's window (or brings its existing window forward).
 * @returns `openApp(appId, launchArgument?)`; unknown app ids are ignored.
 */
export function useOpenApp(): (appId: string, launchArgument?: string) => void {
  const { windowManagerStore } = useDesktopSession();
  return useCallback(
    (appId: string, launchArgument?: string) => {
      const appManifest = findAppManifest(appId);
      if (appManifest === undefined) {
        return;
      }
      windowManagerStore.getState().openWindow(buildOpenWindowRequest(appManifest, launchArgument));
    },
    [windowManagerStore],
  );
}

/**
 * Returns a function that brings an app forward, the way clicking its Dock icon does: an app that
 * can have several windows (Finder) brings its front-most window forward, restoring it if it was
 * minimized, and opens a new window only when it has none. Single-window apps open or come forward.
 * @returns `activateApp(appId)`; unknown app ids are ignored.
 */
export function useActivateApp(): (appId: string) => void {
  const { windowManagerStore } = useDesktopSession();
  const openApp = useOpenApp();
  return useCallback(
    (appId: string) => {
      const appManifest = findAppManifest(appId);
      const topmostAppWindow = selectTopmostWindowOfApp(windowManagerStore.getState(), appId);
      const shouldBringExistingWindowForward =
        appManifest?.allowsMultipleWindows === true && topmostAppWindow !== undefined;
      if (shouldBringExistingWindowForward) {
        windowManagerStore.getState().restoreWindow(topmostAppWindow.id);
        return;
      }
      openApp(appId);
    },
    [windowManagerStore, openApp],
  );
}
