import { describe, expect, it } from 'vitest';
import {
  clampWindowBoundsToDesktopArea,
  computeCascadedWindowBounds,
  computeZoomedWindowBounds,
  dockReservedHeightInPixels,
  smallestWindowSize,
  windowCascadeStepInPixels,
} from './window-geometry.mts';

const desktopArea = { width: 1280, height: 690 };

describe('clampWindowBoundsToDesktopArea', () => {
  it('keeps a window that already fits unchanged', () => {
    const fittingBounds = { x: 100, y: 50, width: 400, height: 300 };
    expect(clampWindowBoundsToDesktopArea(fittingBounds, desktopArea)).toEqual(fittingBounds);
  });

  it('never lets a window go above the menu bar or past the edges', () => {
    expect(
      clampWindowBoundsToDesktopArea({ x: -50, y: -500, width: 400, height: 300 }, desktopArea),
    ).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    expect(
      clampWindowBoundsToDesktopArea({ x: 5000, y: 5000, width: 400, height: 300 }, desktopArea),
    ).toEqual({ x: 880, y: 390, width: 400, height: 300 });
  });

  it('shrinks oversized windows and grows undersized ones to the minimum', () => {
    expect(
      clampWindowBoundsToDesktopArea({ x: 0, y: 0, width: 9999, height: 9999 }, desktopArea),
    ).toEqual({ x: 0, y: 0, width: 1280, height: 690 });
    expect(
      clampWindowBoundsToDesktopArea({ x: 0, y: 0, width: 10, height: 10 }, desktopArea),
    ).toEqual({
      x: 0,
      y: 0,
      ...smallestWindowSize,
    });
  });

  it('rounds to whole pixels', () => {
    expect(
      clampWindowBoundsToDesktopArea(
        { x: 10.6, y: 20.2, width: 300.4, height: 200.5 },
        desktopArea,
      ),
    ).toEqual({ x: 11, y: 20, width: 300, height: 201 });
  });
});

describe('computeCascadedWindowBounds', () => {
  it('centres the first window horizontally in the upper third', () => {
    expect(computeCascadedWindowBounds({ width: 400, height: 300 }, desktopArea, 0)).toEqual({
      x: 440,
      y: 130,
      width: 400,
      height: 300,
    });
  });

  it('offsets each following window diagonally and wraps after eight', () => {
    const firstBounds = computeCascadedWindowBounds({ width: 400, height: 300 }, desktopArea, 0);
    const secondBounds = computeCascadedWindowBounds({ width: 400, height: 300 }, desktopArea, 1);
    expect(secondBounds.x - firstBounds.x).toBe(windowCascadeStepInPixels);
    expect(secondBounds.y - firstBounds.y).toBe(windowCascadeStepInPixels);
    expect(computeCascadedWindowBounds({ width: 400, height: 300 }, desktopArea, 8)).toEqual(
      firstBounds,
    );
  });
});

describe('computeZoomedWindowBounds', () => {
  it('fills the desktop area above the Dock', () => {
    expect(computeZoomedWindowBounds(desktopArea)).toEqual({
      x: 0,
      y: 0,
      width: 1280,
      height: 690 - dockReservedHeightInPixels,
    });
  });
});
