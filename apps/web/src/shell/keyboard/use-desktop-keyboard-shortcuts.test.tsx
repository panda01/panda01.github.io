import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aboutThisMacAppId,
  finderAppId,
  getInfoAppId,
} from '../../system/app-registry/app-registry.mts';
import { DesktopSessionProvider } from '../../system/desktop-session/desktop-session-context.tsx';
import type { DesktopSession } from '../../system/desktop-session/desktop-session.mts';
import {
  endTestDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import { useSpotlightStore } from '../spotlight/spotlight-store.mts';
import {
  performDesktopShortcutAction,
  useDesktopKeyboardShortcuts,
} from './use-desktop-keyboard-shortcuts.mts';

let desktopSession: DesktopSession;

beforeEach(async () => {
  desktopSession = await startTestDesktopSession();
});

afterEach(async () => {
  useSpotlightStore.getState().closeSpotlight();
  await endTestDesktopSession(desktopSession);
});

/**
 * Opens a window of an app in the test session.
 * @param appId - The app to open.
 * @param allowsMultipleWindows - Whether the app supports several windows.
 * @returns The window id.
 */
function openTestWindow(appId: string, allowsMultipleWindows: boolean): string {
  return desktopSession.windowManagerStore.getState().openWindow({
    appId,
    title: appId,
    defaultSize: { width: 300, height: 300 },
    allowsMultipleWindows,
    ...(allowsMultipleWindows ? { launchArgument: '/Users/guest' } : {}),
  });
}

/**
 * Wraps the hook under test in the test session's provider.
 * @param props - The hook's rendered children.
 * @param props.children - Children to wrap.
 * @returns The provider element.
 */
function SessionWrapper({ children }: { children: ReactNode }) {
  return (
    <DesktopSessionProvider desktopSession={desktopSession}>{children}</DesktopSessionProvider>
  );
}

/**
 * Presses a key on an element (the event bubbles to the window like a real key press).
 * @param eventTarget - Where the key press happens.
 * @param keyboardEventInit - Key code and modifiers.
 * @returns The dispatched event.
 */
function pressKey(eventTarget: EventTarget, keyboardEventInit: KeyboardEventInit): KeyboardEvent {
  const keyboardEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...keyboardEventInit,
  });
  eventTarget.dispatchEvent(keyboardEvent);
  return keyboardEvent;
}

describe('performDesktopShortcutAction', () => {
  it('does nothing to windows when no window is focused', () => {
    expect(
      performDesktopShortcutAction('close-window', desktopSession.windowManagerStore, vi.fn()),
    ).toBe(false);
  });

  it('closes, minimizes and quits the focused window or app', () => {
    const windowManagerStore = desktopSession.windowManagerStore;
    const firstInfoWindowId = openTestWindow(getInfoAppId, true);

    expect(performDesktopShortcutAction('minimize-window', windowManagerStore, vi.fn())).toBe(true);
    expect(windowManagerStore.getState().windowsById[firstInfoWindowId]?.isMinimized).toBe(true);

    windowManagerStore.getState().restoreWindow(firstInfoWindowId);
    expect(performDesktopShortcutAction('close-window', windowManagerStore, vi.fn())).toBe(true);
    expect(windowManagerStore.getState().windowsById[firstInfoWindowId]).toBeUndefined();

    openTestWindow(aboutThisMacAppId, false);
    expect(performDesktopShortcutAction('quit-app', windowManagerStore, vi.fn())).toBe(true);
    expect(windowManagerStore.getState().windowStackOrder).toEqual([]);
  });

  it('opens a new window only for apps that allow several windows', () => {
    const windowManagerStore = desktopSession.windowManagerStore;
    openTestWindow(aboutThisMacAppId, false);
    expect(performDesktopShortcutAction('new-window', windowManagerStore, vi.fn())).toBe(false);

    openTestWindow(getInfoAppId, true);
    expect(performDesktopShortcutAction('new-window', windowManagerStore, vi.fn())).toBe(true);
    expect(windowManagerStore.getState().windowStackOrder).toHaveLength(3);
  });

  it('opens a new Finder window when no window is focused', () => {
    const windowManagerStore = desktopSession.windowManagerStore;

    expect(performDesktopShortcutAction('new-window', windowManagerStore, vi.fn())).toBe(true);

    expect(Object.values(windowManagerStore.getState().windowsById)[0]?.appId).toBe(finderAppId);
  });

  it('toggles Spotlight with or without a focused window, and leaves the app switcher for later', () => {
    const toggleSpotlight = vi.fn();

    expect(
      performDesktopShortcutAction('spotlight', desktopSession.windowManagerStore, toggleSpotlight),
    ).toBe(true);
    openTestWindow(aboutThisMacAppId, false);
    expect(
      performDesktopShortcutAction('app-switcher', desktopSession.windowManagerStore, vi.fn()),
    ).toBe(false);

    expect(toggleSpotlight).toHaveBeenCalledOnce();
  });
});

describe('useDesktopKeyboardShortcuts', () => {
  it('handles ⌥ shortcuts and prevents the browser default', () => {
    renderHook(
      () => {
        useDesktopKeyboardShortcuts(false);
      },
      { wrapper: SessionWrapper },
    );
    openTestWindow(aboutThisMacAppId, false);

    const closeKeyPress = pressKey(window, { code: 'KeyW', altKey: true });

    expect(closeKeyPress.defaultPrevented).toBe(true);
    expect(desktopSession.windowManagerStore.getState().windowStackOrder).toEqual([]);
  });

  it('ignores ⌥ shortcuts typed into a text field, unhandled shortcuts, and other keys', () => {
    renderHook(
      () => {
        useDesktopKeyboardShortcuts(false);
      },
      { wrapper: SessionWrapper },
    );
    openTestWindow(aboutThisMacAppId, false);
    const textField = document.createElement('input');
    document.body.append(textField);

    pressKey(textField, { code: 'KeyW', altKey: true });
    const appSwitcherKeyPress = pressKey(window, { code: 'Tab', altKey: true });
    pressKey(window, { code: 'KeyW' });

    expect(appSwitcherKeyPress.defaultPrevented).toBe(false);
    expect(desktopSession.windowManagerStore.getState().windowStackOrder).toHaveLength(1);
    textField.remove();
  });

  it('handles ⌘ shortcuts while the keyboard is locked, and stops listening when unmounted', () => {
    const { unmount } = renderHook(
      () => {
        useDesktopKeyboardShortcuts(true);
      },
      { wrapper: SessionWrapper },
    );
    openTestWindow(aboutThisMacAppId, false);

    pressKey(window, { code: 'KeyM', metaKey: true });
    expect(
      Object.values(desktopSession.windowManagerStore.getState().windowsById)[0]?.isMinimized,
    ).toBe(true);

    unmount();
    const aboutWindowId = desktopSession.windowManagerStore.getState().windowStackOrder[0] ?? '';
    desktopSession.windowManagerStore.getState().restoreWindow(aboutWindowId);
    pressKey(window, { code: 'KeyW', metaKey: true });
    expect(desktopSession.windowManagerStore.getState().windowStackOrder).toHaveLength(1);
  });

  it('opens Spotlight with ⌥Space', () => {
    renderHook(
      () => {
        useDesktopKeyboardShortcuts(false);
      },
      { wrapper: SessionWrapper },
    );

    const spotlightKeyPress = pressKey(window, { code: 'Space', altKey: true });

    expect(spotlightKeyPress.defaultPrevented).toBe(true);
    expect(useSpotlightStore.getState().isSpotlightOpen).toBe(true);
  });
});
