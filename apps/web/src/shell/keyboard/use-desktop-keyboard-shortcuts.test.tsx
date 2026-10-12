import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aboutThisMacAppId, getInfoAppId } from '../../system/app-registry/app-registry.mts';
import { DesktopSessionProvider } from '../../system/desktop-session/desktop-session-context.tsx';
import type { DesktopSession } from '../../system/desktop-session/desktop-session.mts';
import {
  endTestDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import {
  performDesktopShortcutAction,
  useDesktopKeyboardShortcuts,
} from './use-desktop-keyboard-shortcuts.mts';

let desktopSession: DesktopSession;

beforeEach(async () => {
  desktopSession = await startTestDesktopSession();
});

afterEach(async () => {
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
  it('does nothing when no window is focused', () => {
    expect(performDesktopShortcutAction('close-window', desktopSession.windowManagerStore)).toBe(
      false,
    );
  });

  it('closes, minimizes and quits the focused window or app', () => {
    const windowManagerStore = desktopSession.windowManagerStore;
    const firstInfoWindowId = openTestWindow(getInfoAppId, true);

    expect(performDesktopShortcutAction('minimize-window', windowManagerStore)).toBe(true);
    expect(windowManagerStore.getState().windowsById[firstInfoWindowId]?.isMinimized).toBe(true);

    windowManagerStore.getState().restoreWindow(firstInfoWindowId);
    expect(performDesktopShortcutAction('close-window', windowManagerStore)).toBe(true);
    expect(windowManagerStore.getState().windowsById[firstInfoWindowId]).toBeUndefined();

    openTestWindow(aboutThisMacAppId, false);
    expect(performDesktopShortcutAction('quit-app', windowManagerStore)).toBe(true);
    expect(windowManagerStore.getState().windowStackOrder).toEqual([]);
  });

  it('opens a new window only for apps that allow several windows', () => {
    const windowManagerStore = desktopSession.windowManagerStore;
    openTestWindow(aboutThisMacAppId, false);
    expect(performDesktopShortcutAction('new-window', windowManagerStore)).toBe(false);

    openTestWindow(getInfoAppId, true);
    expect(performDesktopShortcutAction('new-window', windowManagerStore)).toBe(true);
    expect(windowManagerStore.getState().windowStackOrder).toHaveLength(3);
  });

  it('leaves the app switcher and Spotlight for later phases', () => {
    openTestWindow(aboutThisMacAppId, false);
    expect(performDesktopShortcutAction('app-switcher', desktopSession.windowManagerStore)).toBe(
      false,
    );
    expect(performDesktopShortcutAction('spotlight', desktopSession.windowManagerStore)).toBe(
      false,
    );
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
    const spotlightKeyPress = pressKey(window, { code: 'Space', altKey: true });
    pressKey(window, { code: 'KeyW' });

    expect(spotlightKeyPress.defaultPrevented).toBe(false);
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
});
