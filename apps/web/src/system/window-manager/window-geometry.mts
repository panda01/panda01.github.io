import type { DesktopAreaSize, WindowBounds } from './window.types.mts';

/** Height of the menu bar; the desktop area for windows starts right below it. */
export const menuBarHeightInPixels = 30;

/** Space kept free at the bottom of the screen for the Dock when a window is zoomed. */
export const dockReservedHeightInPixels = 84;

/** How far each newly opened window is offset from the previous one. */
export const windowCascadeStepInPixels = 26;

/** Smallest size any window can be resized to. */
export const smallestWindowSize = { width: 240, height: 160 } as const;

/**
 * Keeps a window fully inside the desktop area: never above the menu bar, never past the edges,
 * and never bigger than the area itself.
 * @param windowBounds - The window's requested position and size.
 * @param desktopAreaSize - The size of the area below the menu bar.
 * @returns The adjusted bounds.
 */
export function clampWindowBoundsToDesktopArea(
  windowBounds: WindowBounds,
  desktopAreaSize: DesktopAreaSize,
): WindowBounds {
  const clampedWidth = Math.min(
    Math.max(windowBounds.width, smallestWindowSize.width),
    desktopAreaSize.width,
  );
  const clampedHeight = Math.min(
    Math.max(windowBounds.height, smallestWindowSize.height),
    desktopAreaSize.height,
  );
  return {
    x: Math.round(clampNumber(windowBounds.x, 0, desktopAreaSize.width - clampedWidth)),
    y: Math.round(clampNumber(windowBounds.y, 0, desktopAreaSize.height - clampedHeight)),
    width: Math.round(clampedWidth),
    height: Math.round(clampedHeight),
  };
}

/**
 * Picks where a new window opens: roughly centred in the upper part of the screen, shifted
 * diagonally for each window already open so new windows never sit exactly on top of old ones.
 * @param windowSize - Width and height of the new window.
 * @param windowSize.width - The new window's width.
 * @param windowSize.height - The new window's height.
 * @param desktopAreaSize - The size of the area below the menu bar.
 * @param numberOfOpenWindows - How many windows are already open.
 * @returns The new window's bounds.
 */
export function computeCascadedWindowBounds(
  windowSize: { width: number; height: number },
  desktopAreaSize: DesktopAreaSize,
  numberOfOpenWindows: number,
): WindowBounds {
  const cascadeOffset = (numberOfOpenWindows % 8) * windowCascadeStepInPixels;
  const centredX = (desktopAreaSize.width - windowSize.width) / 2;
  const upperThirdY = (desktopAreaSize.height - windowSize.height) / 3;
  return clampWindowBoundsToDesktopArea(
    {
      x: centredX + cascadeOffset,
      y: upperThirdY + cascadeOffset,
      width: windowSize.width,
      height: windowSize.height,
    },
    desktopAreaSize,
  );
}

/**
 * Computes the bounds of a zoomed (maximized) window: the whole desktop area except the Dock strip.
 * @param desktopAreaSize - The size of the area below the menu bar.
 * @returns The zoomed bounds.
 */
export function computeZoomedWindowBounds(desktopAreaSize: DesktopAreaSize): WindowBounds {
  return clampWindowBoundsToDesktopArea(
    {
      x: 0,
      y: 0,
      width: desktopAreaSize.width,
      height: desktopAreaSize.height - dockReservedHeightInPixels,
    },
    desktopAreaSize,
  );
}

/**
 * Restricts a number to a range; when the range is inverted (max below min) the minimum wins.
 * @param value - The number to restrict.
 * @param minimum - The lowest allowed value.
 * @param maximum - The highest allowed value.
 * @returns The restricted number.
 */
function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
