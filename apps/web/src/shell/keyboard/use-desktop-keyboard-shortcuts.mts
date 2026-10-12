import { useEffect } from 'react';
import {
  buildOpenWindowRequest,
  findAppManifest,
} from '../../system/app-registry/app-registry.mts';
import { useDesktopSession } from '../../system/desktop-session/desktop-session-context.tsx';
import {
  isTextEntryTarget,
  resolveDesktopShortcutAction,
} from '../../system/keyboard/desktop-keyboard-shortcuts.mts';
import type { DesktopShortcutAction } from '../../system/keyboard/desktop-keyboard-shortcuts.mts';
import { selectFocusedWindow } from '../../system/window-manager/window-manager-store.mts';
import type { WindowManagerStore } from '../../system/window-manager/window-manager-store.mts';

/**
 * Carries out a desktop shortcut on the focused window or app.
 * @param shortcutAction - The action to perform.
 * @param windowManagerStore - The window manager.
 * @returns True when the shortcut did something (so the browser's default should be prevented).
 */
export function performDesktopShortcutAction(
  shortcutAction: DesktopShortcutAction,
  windowManagerStore: WindowManagerStore,
): boolean {
  const windowManagerState = windowManagerStore.getState();
  const focusedWindow = selectFocusedWindow(windowManagerState);
  if (focusedWindow === undefined) {
    return false;
  }
  switch (shortcutAction) {
    case 'close-window':
      windowManagerState.closeWindow(focusedWindow.id);
      return true;
    case 'quit-app':
      windowManagerState.closeAllWindowsOfApp(focusedWindow.appId);
      return true;
    case 'minimize-window':
      windowManagerState.minimizeWindow(focusedWindow.id);
      return true;
    case 'new-window': {
      const focusedAppManifest = findAppManifest(focusedWindow.appId);
      if (focusedAppManifest?.allowsMultipleWindows !== true) {
        return false;
      }
      windowManagerState.openWindow(buildOpenWindowRequest(focusedAppManifest));
      return true;
    }
    case 'app-switcher':
    case 'spotlight':
      // The app switcher arrives in Phase 5 and Spotlight in Phase 2.
      return false;
  }
}

/**
 * Listens for the desktop's keyboard shortcuts (⌥W, ⌥Q, ⌥M, ⌥N, plus ⌘ versions while the keyboard
 * is locked in full-screen). ⌥ shortcuts are ignored while typing in a text field or the Terminal.
 * @param isKeyboardLockActive - Whether ⌘ shortcuts are currently captured.
 */
export function useDesktopKeyboardShortcuts(isKeyboardLockActive: boolean): void {
  const { windowManagerStore } = useDesktopSession();

  useEffect(() => {
    /**
     * Handles one key press.
     * @param keyboardEvent - The key press.
     */
    function handleDesktopShortcutKeyDown(keyboardEvent: KeyboardEvent): void {
      const shortcutAction = resolveDesktopShortcutAction(keyboardEvent, isKeyboardLockActive);
      if (shortcutAction === undefined) {
        return;
      }
      const isOptionShortcutWhileTyping =
        keyboardEvent.altKey && isTextEntryTarget(keyboardEvent.target);
      if (isOptionShortcutWhileTyping) {
        return;
      }
      if (performDesktopShortcutAction(shortcutAction, windowManagerStore)) {
        keyboardEvent.preventDefault();
      }
    }

    window.addEventListener('keydown', handleDesktopShortcutKeyDown);
    return () => {
      window.removeEventListener('keydown', handleDesktopShortcutKeyDown);
    };
  }, [windowManagerStore, isKeyboardLockActive]);
}
