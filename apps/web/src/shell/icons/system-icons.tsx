import { useId } from 'react';
import type { JSX } from 'react';
import type { IconProps } from './item-icons.tsx';

/**
 * The site's own system logo (a "k" monogram) used where macOS shows the Apple logo. Original
 * artwork: the Apple logo itself must not be used.
 * @param props - Icon props.
 * @param props.size - Width and height in pixels.
 * @returns The SVG logo, drawn in the current text colour.
 */
export function SystemLogoIcon({ size }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5" />
      <path
        d="M24 16v32M24 34l14-14M28 30l12 18"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * App icon for About This Mac: a rounded tile with an "i" (original artwork).
 * @param props - Icon props.
 * @param props.size - Width and height in pixels.
 * @returns The SVG icon.
 */
export function AboutThisMacAppIcon({ size }: IconProps): JSX.Element {
  // Each copy of the icon (Dock, window, menus) needs its own gradient id to keep ids unique.
  const gradientId = `about-tile-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8e9aaf" />
          <stop offset="1" stopColor="#4a5568" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill={`url(#${gradientId})`} />
      <circle cx="32" cy="18" r="5" fill="#ffffff" />
      <rect x="27" y="27" width="10" height="24" rx="4" fill="#ffffff" />
    </svg>
  );
}

/**
 * Trash can artwork, empty or with crumpled papers (original design).
 * @param props - Icon props plus whether the Trash has items.
 * @param props.size - Width and height in pixels.
 * @param props.isFull - Whether to draw papers inside the can.
 * @returns The SVG icon.
 */
export function TrashCanIcon({ size, isFull }: IconProps & { isFull: boolean }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {isFull ? (
        <g fill="#f4f4f5" stroke="#c4c7cc">
          <circle cx="26" cy="16" r="7" />
          <circle cx="37" cy="14" r="6" />
          <circle cx="31" cy="11" r="5" />
        </g>
      ) : null}
      <path
        d="M14 18h36l-4 40a3 3 0 0 1-3 3H21a3 3 0 0 1-3-3z"
        fill="#d7dade"
        stroke="#9ca3af"
        strokeWidth="1.5"
      />
      <rect
        x="11"
        y="15"
        width="42"
        height="6"
        rx="3"
        fill="#e5e7eb"
        stroke="#9ca3af"
        strokeWidth="1.5"
      />
      {[24, 32, 40].map((ribX) => (
        <path key={ribX} d={`M${String(ribX)} 26v28`} stroke="#9ca3af" strokeWidth="2" />
      ))}
    </svg>
  );
}

/**
 * App icon for Finder: a blue tile with a small window that has a sidebar (original artwork, not
 * Apple's Finder face).
 * @param props - Icon props.
 * @param props.size - Width and height in pixels.
 * @returns The SVG icon.
 */
export function FinderAppIcon({ size }: IconProps): JSX.Element {
  // Each copy of the icon (Dock, Spotlight, menus) needs its own gradient id to keep ids unique.
  const gradientId = `finder-tile-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6cc4ff" />
          <stop offset="1" stopColor="#1d6fe0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill={`url(#${gradientId})`} />
      <rect x="11" y="15" width="42" height="34" rx="5" fill="#ffffff" />
      <path d="M16 15h7v34h-7a5 5 0 0 1-5-5V20a5 5 0 0 1 5-5z" fill="#d3e6fb" />
      {[22, 28, 34].map((rowY) => (
        <rect key={rowY} x="27" y={rowY} width="20" height="3" rx="1.5" fill="#9cc3ef" />
      ))}
      <circle cx="15" cy="19" r="1.3" fill="#ff5f57" />
      <circle cx="19" cy="19" r="1.3" fill="#febc2e" />
    </svg>
  );
}

/**
 * App icon for Quick Look: a grey tile with an eye (original artwork).
 * @param props - Icon props.
 * @param props.size - Width and height in pixels.
 * @returns The SVG icon.
 */
export function QuickLookAppIcon({ size }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#5f6672" />
      <path d="M10 32c6-10 14-15 22-15s16 5 22 15c-6 10-14 15-22 15s-16-5-22-15z" fill="#ffffff" />
      <circle cx="32" cy="32" r="8" fill="#5f6672" />
      <circle cx="35" cy="29" r="2.5" fill="#ffffff" />
    </svg>
  );
}
