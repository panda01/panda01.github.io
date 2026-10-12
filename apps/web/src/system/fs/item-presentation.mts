import type { FileSystemItem } from './file-system.types.mts';

/** Which original icon artwork represents an item (see shell/icons/item-icons.tsx). */
export type ItemIconKind =
  | 'folder'
  | 'folder-alias'
  | 'text-document'
  | 'pdf-document'
  | 'image-document'
  | 'generic-document'
  | 'web-link'
  | 'email-link';

/**
 * Chooses the icon artwork for a filesystem item.
 * @param item - The file, folder or link.
 * @returns The icon kind to draw.
 */
export function chooseItemIconKind(item: FileSystemItem): ItemIconKind {
  if (item.kind === 'folder') {
    return 'folder';
  }
  if (item.kind === 'link') {
    if (item.linkTarget?.kind === 'path') {
      return 'folder-alias';
    }
    return item.linkTarget?.url.startsWith('mailto:') === true ? 'email-link' : 'web-link';
  }
  if (item.mimeType === 'application/pdf') {
    return 'pdf-document';
  }
  if (item.mimeType.startsWith('image/')) {
    return 'image-document';
  }
  if (item.mimeType.startsWith('text/')) {
    return 'text-document';
  }
  return 'generic-document';
}

/** How Quick Look shows an item: its text, its image, its PDF pages, or a summary card. */
export type QuickLookPreviewKind = 'text' | 'image' | 'pdf' | 'summary';

/**
 * Chooses how Quick Look previews an item. Markdown and other text formats are shown as plain
 * text; folders, links and unknown file types get a summary card (icon, kind, size).
 * @param item - The item to preview.
 * @returns The kind of preview to show.
 */
export function chooseQuickLookPreviewKind(item: FileSystemItem): QuickLookPreviewKind {
  if (item.kind !== 'file') {
    return 'summary';
  }
  if (item.mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (item.mimeType.startsWith('image/')) {
    return 'image';
  }
  const isTextContent = item.mimeType.startsWith('text/') || item.mimeType === 'application/json';
  return isTextContent ? 'text' : 'summary';
}

/**
 * Describes an item's kind the way Finder's Get Info window does.
 * @param item - The file, folder or link.
 * @returns A label such as "Folder", "PDF Document" or "Web Link".
 */
export function describeItemKind(item: FileSystemItem): string {
  const kindLabelsByIconKind: Record<ItemIconKind, string> = {
    folder: 'Folder',
    'folder-alias': 'Alias',
    'text-document': 'Plain Text Document',
    'pdf-document': 'PDF Document',
    'image-document': 'Image',
    'generic-document': 'Document',
    'web-link': 'Web Link',
    'email-link': 'Email Link',
  };
  return kindLabelsByIconKind[chooseItemIconKind(item)];
}

/**
 * Formats a size the way macOS does (decimal units: 1 KB = 1,000 bytes).
 * @param sizeInBytes - The size to format.
 * @returns For example "Zero bytes", "685 bytes", "12 KB" or "1.2 MB".
 */
export function formatByteSize(sizeInBytes: number): string {
  if (sizeInBytes === 0) {
    return 'Zero bytes';
  }
  if (sizeInBytes < 1000) {
    return `${String(sizeInBytes)} byte${sizeInBytes === 1 ? '' : 's'}`;
  }
  const sizeUnits = ['KB', 'MB', 'GB', 'TB'];
  let scaledSize = sizeInBytes / 1000;
  let unitIndex = 0;
  while (scaledSize >= 1000 && unitIndex < sizeUnits.length - 1) {
    scaledSize /= 1000;
    unitIndex += 1;
  }
  const roundedSize = scaledSize < 10 ? Math.round(scaledSize * 10) / 10 : Math.round(scaledSize);
  return `${String(roundedSize)} ${sizeUnits[unitIndex] ?? 'TB'}`;
}

/**
 * Formats a timestamp for Get Info, for example "Sunday, October 11, 2026 at 9:41 AM".
 * @param timestamp - Milliseconds since the Unix epoch.
 * @param locale - The locale to format for.
 * @returns The formatted date and time.
 */
export function formatItemTimestamp(timestamp: number, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(
    new Date(timestamp),
  );
}
