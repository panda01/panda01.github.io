import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFullScreenState } from './use-full-screen-state.mts';

// jsdom has no Fullscreen API, so the tests control `document.fullscreenElement` themselves.
let currentFullScreenElement: Element | null = null;
let requestFullscreenMock = vi.fn(() => Promise.resolve());
let exitFullscreenMock = vi.fn(() => Promise.resolve());

/**
 * Simulates the browser entering or leaving full-screen.
 * @param fullScreenElement - The full-screen element, or null when leaving full-screen.
 */
function simulateFullScreenChange(fullScreenElement: Element | null): void {
  currentFullScreenElement = fullScreenElement;
  document.dispatchEvent(new Event('fullscreenchange'));
}

beforeEach(() => {
  currentFullScreenElement = null;
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    /**
     * Reports the simulated full-screen element.
     * @returns The element, or null when not full-screen.
     */
    get: () => currentFullScreenElement,
  });
  requestFullscreenMock = vi.fn(() => Promise.resolve());
  exitFullscreenMock = vi.fn(() => Promise.resolve());
  document.documentElement.requestFullscreen = requestFullscreenMock;
  document.exitFullscreen = exitFullscreenMock;
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'keyboard');
});

describe('useFullScreenState', () => {
  it('follows the browser entering and leaving full-screen', () => {
    const { result } = renderHook(() => useFullScreenState());
    expect(result.current.isFullScreen).toBe(false);

    act(() => {
      simulateFullScreenChange(document.documentElement);
    });
    expect(result.current.isFullScreen).toBe(true);

    act(() => {
      simulateFullScreenChange(null);
    });
    expect(result.current.isFullScreen).toBe(false);
  });

  it('locks the keyboard when entering full-screen and releases it when leaving', async () => {
    Object.defineProperty(navigator, 'keyboard', {
      configurable: true,
      value: { lock: vi.fn(() => Promise.resolve()), unlock: vi.fn() },
    });
    const { result } = renderHook(() => useFullScreenState());

    act(() => {
      result.current.enterFullScreen();
    });
    await waitFor(() => {
      expect(result.current.isKeyboardLocked).toBe(true);
    });
    expect(requestFullscreenMock).toHaveBeenCalled();

    act(() => {
      simulateFullScreenChange(null);
    });
    expect(result.current.isKeyboardLocked).toBe(false);
  });

  it('exits full-screen on request', async () => {
    const { result } = renderHook(() => useFullScreenState());
    act(() => {
      simulateFullScreenChange(document.documentElement);
    });

    act(() => {
      result.current.exitFullScreen();
    });

    await waitFor(() => {
      expect(exitFullscreenMock).toHaveBeenCalled();
    });
  });

  it('reports refused full-screen requests without failing', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    document.documentElement.requestFullscreen = vi.fn(() => Promise.reject(new Error('denied')));
    document.exitFullscreen = vi.fn(() => Promise.reject(new Error('denied')));
    const { result } = renderHook(() => useFullScreenState());
    act(() => {
      simulateFullScreenChange(document.documentElement);
    });

    act(() => {
      result.current.enterFullScreen();
      result.current.exitFullScreen();
    });

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });
    expect(result.current.isKeyboardLocked).toBe(false);
  });
});
