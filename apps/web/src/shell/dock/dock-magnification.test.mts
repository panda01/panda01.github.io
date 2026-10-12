import { describe, expect, it } from 'vitest';
import {
  computeMagnifiedIconSize,
  defaultDockMagnificationSettings,
} from './dock-magnification.mts';

const { restingIconSize, magnifiedIconSize, influenceRadius } = defaultDockMagnificationSettings;

describe('computeMagnifiedIconSize', () => {
  it('is fully magnified directly under the pointer', () => {
    expect(computeMagnifiedIconSize(0)).toBe(magnifiedIconSize);
  });

  it('is at resting size at or beyond the influence radius, or with no pointer', () => {
    expect(computeMagnifiedIconSize(influenceRadius)).toBe(restingIconSize);
    expect(computeMagnifiedIconSize(-influenceRadius * 2)).toBe(restingIconSize);
    expect(computeMagnifiedIconSize(Number.POSITIVE_INFINITY)).toBe(restingIconSize);
  });

  it('is symmetric and shrinks as the pointer moves away', () => {
    const nearSize = computeMagnifiedIconSize(30);
    const farSize = computeMagnifiedIconSize(100);
    expect(computeMagnifiedIconSize(-30)).toBe(nearSize);
    expect(nearSize).toBeGreaterThan(farSize);
    expect(farSize).toBeGreaterThan(restingIconSize);
    expect(computeMagnifiedIconSize(influenceRadius / 2)).toBeCloseTo(
      (restingIconSize + magnifiedIconSize) / 2,
    );
  });

  it('uses custom settings', () => {
    expect(
      computeMagnifiedIconSize(0, {
        restingIconSize: 10,
        magnifiedIconSize: 20,
        influenceRadius: 5,
      }),
    ).toBe(20);
  });
});
