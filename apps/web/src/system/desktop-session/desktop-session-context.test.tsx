import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  endTestDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import { aboutThisMacAppId, finderAppId } from '../app-registry/app-registry.mts';
import { selectFocusedWindow } from '../window-manager/window-manager-store.mts';
import {
  DesktopSessionProvider,
  useActivateApp,
  useDesktopSession,
  useOpenApp,
  useWindowManager,
} from './desktop-session-context.tsx';
import type { DesktopSession } from './desktop-session.mts';

let desktopSession: DesktopSession;

beforeEach(async () => {
  desktopSession = await startTestDesktopSession();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await endTestDesktopSession(desktopSession);
});

/**
 * Wraps hooks under test in the test session's provider.
 * @param props - The hook's rendered children.
 * @param props.children - Children to wrap.
 * @returns The provider element.
 */
function SessionWrapper({ children }: { children: ReactNode }) {
  return (
    <DesktopSessionProvider desktopSession={desktopSession}>{children}</DesktopSessionProvider>
  );
}

describe('desktop session context', () => {
  it('provides the running session', () => {
    const { result } = renderHook(() => useDesktopSession(), { wrapper: SessionWrapper });

    expect(result.current).toBe(desktopSession);
  });

  it('refuses to be used outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useDesktopSession())).toThrow(
      'useDesktopSession must be used inside a DesktopSessionProvider.',
    );
  });

  it('opens known apps and ignores unknown ones', () => {
    const { result } = renderHook(
      () => ({
        openApp: useOpenApp(),
        openWindowCount: useWindowManager((windowState) => windowState.windowStackOrder.length),
      }),
      { wrapper: SessionWrapper },
    );

    act(() => {
      result.current.openApp('no-such-app');
    });
    expect(result.current.openWindowCount).toBe(0);

    act(() => {
      result.current.openApp(aboutThisMacAppId);
    });
    expect(result.current.openWindowCount).toBe(1);
  });

  it('activating Finder brings its front-most window forward and opens one only when none exist', () => {
    const { result } = renderHook(
      () => ({
        activateApp: useActivateApp(),
        openWindowCount: useWindowManager((windowState) => windowState.windowStackOrder.length),
      }),
      { wrapper: SessionWrapper },
    );
    const windowActions = desktopSession.windowManagerStore.getState();

    act(() => {
      result.current.activateApp(finderAppId);
    });
    expect(result.current.openWindowCount).toBe(1);
    const finderWindow = selectFocusedWindow(desktopSession.windowManagerStore.getState());
    expect(finderWindow?.appId).toBe(finderAppId);

    act(() => {
      if (finderWindow !== undefined) {
        windowActions.minimizeWindow(finderWindow.id);
      }
      result.current.activateApp(finderAppId);
      result.current.activateApp(aboutThisMacAppId);
      result.current.activateApp(finderAppId);
    });
    expect(result.current.openWindowCount).toBe(2);
    expect(selectFocusedWindow(desktopSession.windowManagerStore.getState())?.id).toBe(
      finderWindow?.id,
    );
  });
});
