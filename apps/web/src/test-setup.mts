import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { afterEach } from 'vitest';

// Animations finish instantly in unit tests, so assertions never race an animation.
MotionGlobalConfig.skipAnimations = true;

// Vitest globals are off, so Testing Library cannot register its automatic cleanup itself.
afterEach(() => {
  cleanup();
});

/**
 * Minimal stand-in for `window.matchMedia`, which jsdom does not implement. Every query reports
 * "no match", which is the desktop default for media features like reduced motion and dark mode.
 * @param mediaQuery - The CSS media query being evaluated.
 * @returns A MediaQueryList that never matches and never fires change events.
 */
function createNonMatchingMediaQueryList(mediaQuery: string): MediaQueryList {
  const nonMatchingMediaQueryList: Partial<MediaQueryList> = {
    matches: false,
    media: mediaQuery,
    onchange: null,
    addEventListener: ignoreListenerRegistration,
    removeEventListener: ignoreListenerRegistration,
    addListener: ignoreListenerRegistration,
    removeListener: ignoreListenerRegistration,
    dispatchEvent: reportEventNotDispatched,
  };
  return nonMatchingMediaQueryList as MediaQueryList;
}

/**
 * Accepts and ignores a listener registration on the stub media query list.
 */
function ignoreListenerRegistration(): void {
  // Media queries never change inside jsdom, so listeners never need to run.
}

/**
 * Reports that the stub media query list did not dispatch an event.
 * @returns Always false.
 */
function reportEventNotDispatched(): boolean {
  return false;
}

/**
 * Minimal stand-in for `ResizeObserver`, which jsdom does not implement. jsdom performs no layout,
 * so there are never any size changes to report.
 */
class ResizeObserverThatNeverReports implements ResizeObserver {
  /**
   * Starts "observing" an element; no-op because jsdom never resizes anything.
   */
  observe(): void {
    // Intentionally empty: there is no layout in jsdom.
  }

  /**
   * Stops "observing" an element; no-op.
   */
  unobserve(): void {
    // Intentionally empty: nothing was being observed.
  }

  /**
   * Stops "observing" all elements; no-op.
   */
  disconnect(): void {
    // Intentionally empty: nothing was being observed.
  }
}

/** Pointers captured by each element, for the pointer-capture stand-ins below. */
const capturedPointerIdsByElement = new WeakMap<Element, Set<number>>();

/**
 * Stand-in for `Element.setPointerCapture`, which jsdom does not implement.
 * @param this - The element capturing the pointer.
 * @param pointerId - The pointer to capture.
 */
function recordPointerCapture(this: Element, pointerId: number): void {
  const capturedPointerIds = capturedPointerIdsByElement.get(this) ?? new Set<number>();
  capturedPointerIds.add(pointerId);
  capturedPointerIdsByElement.set(this, capturedPointerIds);
}

/**
 * Stand-in for `Element.releasePointerCapture`.
 * @param this - The element releasing the pointer.
 * @param pointerId - The pointer to release.
 */
function forgetPointerCapture(this: Element, pointerId: number): void {
  capturedPointerIdsByElement.get(this)?.delete(pointerId);
}

/**
 * Stand-in for `Element.hasPointerCapture`.
 * @param this - The element to ask.
 * @param pointerId - The pointer to check.
 * @returns Whether the element captured the pointer.
 */
function checkPointerCapture(this: Element, pointerId: number): boolean {
  return capturedPointerIdsByElement.get(this)?.has(pointerId) ?? false;
}

const isPointerCaptureMissing = !('setPointerCapture' in Element.prototype);
if (isPointerCaptureMissing) {
  Element.prototype.setPointerCapture = recordPointerCapture;
  Element.prototype.releasePointerCapture = forgetPointerCapture;
  Element.prototype.hasPointerCapture = checkPointerCapture;
}

const isMatchMediaMissing = typeof window.matchMedia !== 'function';
if (isMatchMediaMissing) {
  window.matchMedia = createNonMatchingMediaQueryList;
}

const isResizeObserverMissing = typeof window.ResizeObserver !== 'function';
if (isResizeObserverMissing) {
  window.ResizeObserver = ResizeObserverThatNeverReports;
}
