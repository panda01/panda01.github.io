import type { JSX } from 'react';
import type { ItemIconKind } from '../../system/fs/item-presentation.mts';

/** Props shared by every original icon. */
export interface IconProps {
  /** Width and height in CSS pixels. */
  size: number;
}

/**
 * Folder artwork (original design, not Apple's).
 * @param props - Icon props.
 * @param props.size - Width and height in pixels.
 * @returns The SVG icon.
 */
export function FolderIcon({ size }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 16a4 4 0 0 1 4-4h14l5 5h25a4 4 0 0 1 4 4v4H6z" fill="#3b8fe6" />
      <rect x="6" y="21" width="52" height="33" rx="4" fill="#5fb0f7" />
      <rect x="6" y="21" width="52" height="4" fill="#7cc0fa" />
    </svg>
  );
}

/**
 * Alias artwork: a folder with a small curved arrow badge.
 * @param props - Icon props.
 * @param props.size - Width and height in pixels.
 * @returns The SVG icon.
 */
export function FolderAliasIcon({ size }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 16a4 4 0 0 1 4-4h14l5 5h25a4 4 0 0 1 4 4v4H6z" fill="#3b8fe6" />
      <rect x="6" y="21" width="52" height="33" rx="4" fill="#5fb0f7" />
      <rect x="8" y="40" width="16" height="16" rx="3" fill="#ffffff" />
      <path d="M12 52c0-6 3-8 8-8m-3-3 3 3-3 3" stroke="#222" strokeWidth="2" fill="none" />
    </svg>
  );
}

/**
 * Document page artwork with an optional coloured label.
 * @param props - Icon props plus the label.
 * @param props.size - Width and height in pixels.
 * @param props.labelText - Short text on the page (for example "PDF"), if any.
 * @param props.labelColor - Background colour of the label.
 * @returns The SVG icon.
 */
function DocumentPageIcon({
  size,
  labelText,
  labelColor,
}: IconProps & { labelText?: string; labelColor?: string }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M14 4h26l12 12v42a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        fill="#ffffff"
        stroke="#c9ccd1"
      />
      <path d="M40 4v12h12" fill="#e9ebee" stroke="#c9ccd1" />
      {[24, 30, 36, 42].map((lineY) => (
        <rect key={lineY} x="19" y={lineY} width="26" height="2" rx="1" fill="#c9ccd1" />
      ))}
      {labelText === undefined ? null : (
        <>
          <rect x="17" y="44" width="30" height="11" rx="2" fill={labelColor} />
          <text
            x="32"
            y="52.5"
            textAnchor="middle"
            fontSize="8"
            fontWeight="700"
            fill="#ffffff"
            fontFamily="system-ui, sans-serif"
          >
            {labelText}
          </text>
        </>
      )}
    </svg>
  );
}

/**
 * Web link artwork: a globe.
 * @param props - Icon props.
 * @param props.size - Width and height in pixels.
 * @returns The SVG icon.
 */
export function WebLinkIcon({ size }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="#2f7de1" />
      <g stroke="#cfe6ff" strokeWidth="2" fill="none">
        <ellipse cx="32" cy="32" rx="10" ry="24" />
        <path d="M8 32h48M12 20h40M12 44h40" />
      </g>
    </svg>
  );
}

/**
 * Email link artwork: an envelope.
 * @param props - Icon props.
 * @param props.size - Width and height in pixels.
 * @returns The SVG icon.
 */
export function EmailLinkIcon({ size }: IconProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="8" y="16" width="48" height="34" rx="5" fill="#3aa0f0" />
      <path d="M10 19l22 17 22-17" stroke="#ffffff" strokeWidth="3" fill="none" />
    </svg>
  );
}

/**
 * Draws the icon that represents a filesystem item.
 * @param props - The icon kind and size.
 * @param props.iconKind - Which artwork to draw.
 * @param props.size - Width and height in pixels.
 * @returns The SVG icon.
 */
export function ItemIcon({ iconKind, size }: IconProps & { iconKind: ItemIconKind }): JSX.Element {
  switch (iconKind) {
    case 'folder':
      return <FolderIcon size={size} />;
    case 'folder-alias':
      return <FolderAliasIcon size={size} />;
    case 'web-link':
      return <WebLinkIcon size={size} />;
    case 'email-link':
      return <EmailLinkIcon size={size} />;
    case 'pdf-document':
      return <DocumentPageIcon size={size} labelText="PDF" labelColor="#d93a2b" />;
    case 'image-document':
      return <DocumentPageIcon size={size} labelText="IMG" labelColor="#2e9e57" />;
    case 'text-document':
      return <DocumentPageIcon size={size} labelText="TXT" labelColor="#6b7280" />;
    case 'generic-document':
      return <DocumentPageIcon size={size} />;
  }
}
