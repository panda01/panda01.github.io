/** Size settings for Dock icons and their hover magnification. */
export interface DockMagnificationSettings {
  /** Icon size when the pointer is not near the Dock. */
  restingIconSize: number;
  /** Icon size directly under the pointer. */
  magnifiedIconSize: number;
  /** How far from the pointer (in pixels) icons are still enlarged. */
  influenceRadius: number;
}

/** The Dock's default sizes. */
export const defaultDockMagnificationSettings: DockMagnificationSettings = {
  restingIconSize: 48,
  magnifiedIconSize: 80,
  influenceRadius: 150,
};

/**
 * Computes how large a Dock icon should be given how far the pointer is from its centre. Icons under
 * the pointer reach the magnified size, and the effect fades smoothly (cosine curve) to the resting
 * size at the edge of the influence radius.
 * @param pointerDistance - Horizontal distance in pixels from the pointer to the icon's centre.
 * @param magnificationSettings - Sizes and radius to use.
 * @returns The icon size in pixels.
 */
export function computeMagnifiedIconSize(
  pointerDistance: number,
  magnificationSettings: DockMagnificationSettings = defaultDockMagnificationSettings,
): number {
  const { restingIconSize, magnifiedIconSize, influenceRadius } = magnificationSettings;
  const absoluteDistance = Math.abs(pointerDistance);
  const isOutsideInfluence =
    !Number.isFinite(absoluteDistance) || absoluteDistance >= influenceRadius;
  if (isOutsideInfluence) {
    return restingIconSize;
  }
  const closenessFactor = (Math.cos((absoluteDistance / influenceRadius) * Math.PI) + 1) / 2;
  return restingIconSize + (magnifiedIconSize - restingIconSize) * closenessFactor;
}
