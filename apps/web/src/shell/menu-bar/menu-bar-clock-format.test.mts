import { describe, expect, it } from 'vitest';
import { formatMenuBarClock } from './menu-bar-clock-format.mts';

describe('formatMenuBarClock', () => {
  it('formats like the macOS menu bar', () => {
    expect(formatMenuBarClock(new Date(2026, 9, 11, 9, 41))).toBe('Sun Oct 11 9:41 AM');
    expect(formatMenuBarClock(new Date(2026, 0, 2, 21, 5))).toBe('Fri Jan 2 9:05 PM');
  });

  it('respects other locales', () => {
    expect(formatMenuBarClock(new Date(2026, 9, 11, 21, 5), 'en-GB')).toBe('Sun Oct 11 21:05');
  });
});
