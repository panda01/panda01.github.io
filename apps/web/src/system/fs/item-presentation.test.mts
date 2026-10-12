import { describe, expect, it } from 'vitest';
import type { FileSystemItem } from './file-system.types.mts';
import {
  chooseItemIconKind,
  chooseQuickLookPreviewKind,
  describeItemKind,
  formatByteSize,
  formatItemTimestamp,
} from './item-presentation.mts';

/**
 * Builds a filesystem item with sensible defaults.
 * @param overrides - Fields to change.
 * @returns The item.
 */
function buildItem(overrides: Partial<FileSystemItem>): FileSystemItem {
  return {
    id: 'x',
    parentId: 'p',
    name: 'x',
    path: '/x',
    kind: 'file',
    mimeType: 'application/octet-stream',
    sizeInBytes: 0,
    createdAt: 0,
    modifiedAt: 0,
    ...overrides,
  };
}

describe('chooseItemIconKind / describeItemKind', () => {
  it.each([
    [{ kind: 'folder' as const }, 'folder', 'Folder'],
    [
      { kind: 'link' as const, linkTarget: { kind: 'path' as const, path: '/a' } },
      'folder-alias',
      'Alias',
    ],
    [
      { kind: 'link' as const, linkTarget: { kind: 'url' as const, url: 'https://x.y' } },
      'web-link',
      'Web Link',
    ],
    [
      { kind: 'link' as const, linkTarget: { kind: 'url' as const, url: 'mailto:a@b.c' } },
      'email-link',
      'Email Link',
    ],
    [{ kind: 'link' as const }, 'web-link', 'Web Link'],
    [{ mimeType: 'application/pdf' }, 'pdf-document', 'PDF Document'],
    [{ mimeType: 'image/png' }, 'image-document', 'Image'],
    [{ mimeType: 'text/plain' }, 'text-document', 'Plain Text Document'],
    [{ mimeType: 'application/zip' }, 'generic-document', 'Document'],
  ])('maps %o to %s / %s', (itemOverrides, expectedIconKind, expectedKindLabel) => {
    const item = buildItem(itemOverrides);
    expect(chooseItemIconKind(item)).toBe(expectedIconKind);
    expect(describeItemKind(item)).toBe(expectedKindLabel);
  });
});

describe('formatByteSize', () => {
  it.each([
    [0, 'Zero bytes'],
    [1, '1 byte'],
    [685, '685 bytes'],
    [1000, '1 KB'],
    [1250, '1.3 KB'],
    [12_400, '12 KB'],
    [1_234_567, '1.2 MB'],
    [5_000_000_000, '5 GB'],
    [7_000_000_000_000_000, '7000 TB'],
  ])('formats %d as %s', (sizeInBytes, expectedText) => {
    expect(formatByteSize(sizeInBytes)).toBe(expectedText);
  });
});

describe('formatItemTimestamp', () => {
  it('formats dates in full with a short time', () => {
    expect(formatItemTimestamp(new Date(2026, 9, 11, 9, 41).getTime())).toBe(
      'Sunday, October 11, 2026 at 9:41 AM',
    );
  });
});

describe('chooseQuickLookPreviewKind', () => {
  it.each([
    [{ mimeType: 'text/plain' }, 'text'],
    [{ mimeType: 'text/markdown' }, 'text'],
    [{ mimeType: 'application/json' }, 'text'],
    [{ mimeType: 'application/pdf' }, 'pdf'],
    [{ mimeType: 'image/svg+xml' }, 'image'],
    [{ mimeType: 'application/octet-stream' }, 'summary'],
    [{ kind: 'folder' as const, mimeType: 'inode/directory' }, 'summary'],
    [{ kind: 'link' as const, mimeType: 'text/plain' }, 'summary'],
  ])('previews %o as %s', (itemOverrides, expectedPreviewKind) => {
    expect(chooseQuickLookPreviewKind(buildItem(itemOverrides))).toBe(expectedPreviewKind);
  });
});
