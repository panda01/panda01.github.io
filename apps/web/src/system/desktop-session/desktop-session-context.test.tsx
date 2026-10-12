import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  endTestDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import { aboutThisMacAppId } from '../app-registry/app-registry.mts';
import {
  DesktopSessionProvider,
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
});
