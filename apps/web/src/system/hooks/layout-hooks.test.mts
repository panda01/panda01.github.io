import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useElementWidth } from './use-element-width.mts';
import { useValueStableForKey } from './use-value-stable-for-key.mts';

describe('useValueStableForKey', () => {
  it('keeps the first value for a key and switches when the key changes', () => {
    const firstBytes = new Uint8Array([1]);
    const sameBytesCopy = new Uint8Array([1]);
    const changedBytes = new Uint8Array([2]);
    const { result, rerender } = renderHook(
      ({ value, stabilityKey }) => useValueStableForKey(value, stabilityKey),
      { initialProps: { value: firstBytes, stabilityKey: 'v1' } },
    );

    rerender({ value: sameBytesCopy, stabilityKey: 'v1' });
    expect(result.current).toBe(firstBytes);

    rerender({ value: changedBytes, stabilityKey: 'v2' });
    expect(result.current).toBe(changedBytes);
  });
});

describe('useElementWidth', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports the measured width, ignores empty sizes, and stops observing when unmounted', () => {
    const reportSizeRef: { current: ResizeObserverCallback | undefined } = { current: undefined };
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      /** Records the callback so the test can report sizes. */
      class RecordingResizeObserver {
        /**
         * Keeps the callback.
         * @param reportSizes - The observer's callback.
         */
        constructor(reportSizes: ResizeObserverCallback) {
          reportSizeRef.current = reportSizes;
        }

        /**
         * Starts observing; sizes are reported by the test.
         */
        observe(): void {
          // Sizes come from the test.
        }

        disconnect = disconnect;
      },
    );
    const { result, unmount } = renderHook(() => useElementWidth());
    expect(result.current[1]).toBeUndefined();

    act(() => {
      result.current[0](document.createElement('div'));
    });
    /**
     * Reports a width to the hook.
     * @param width - The width.
     */
    function reportWidth(width: number): void {
      act(() => {
        reportSizeRef.current?.([{ contentRect: { width } } as ResizeObserverEntry], {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        });
      });
    }
    reportWidth(0);
    expect(result.current[1]).toBeUndefined();
    reportWidth(412.6);
    expect(result.current[1]).toBe(413);

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
