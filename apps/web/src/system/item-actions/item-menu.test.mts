import { describe, expect, it } from 'vitest';
import type { FileSystemItem } from '../fs/file-system.types.mts';
import { listFolderBackgroundMenuActions, listItemMenuActions } from './item-menu.mts';

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
    path: '/Users/guest/Desktop/x',
    kind: 'file',
    mimeType: 'text/plain',
    sizeInBytes: 0,
    createdAt: 0,
    modifiedAt: 0,
    ...overrides,
  };
}

/**
 * Lists the labels of menu entries.
 * @param menuActions - The entries.
 * @returns Their labels in order.
 */
function listLabels(menuActions: { label: string }[]): string[] {
  return menuActions.map((menuAction) => menuAction.label);
}

describe('listItemMenuActions', () => {
  it('offers downloading for files but never uploading', () => {
    const fileMenuLabels = listLabels(listItemMenuActions(buildItem({})));

    expect(fileMenuLabels).toEqual([
      'Open',
      'Quick Look',
      'Get Info',
      'Rename',
      'Duplicate',
      'Download',
      'Move to Trash',
    ]);
    expect(fileMenuLabels.some((label) => /upload/i.test(label))).toBe(false);
  });

  it('does not offer Download for folders and links', () => {
    expect(listLabels(listItemMenuActions(buildItem({ kind: 'folder' })))).not.toContain(
      'Download',
    );
    expect(listLabels(listItemMenuActions(buildItem({ kind: 'link' })))).not.toContain('Download');
  });

  it('offers Put Back and Delete Immediately for items in the Trash', () => {
    expect(
      listLabels(listItemMenuActions(buildItem({ path: '/Users/guest/.Trash/Notes.txt' }))),
    ).toEqual(['Put Back', 'Delete Immediately', 'Quick Look', 'Get Info']);
  });
});

describe('listFolderBackgroundMenuActions', () => {
  it('offers New Folder in ordinary folders and Empty Trash in the Trash', () => {
    expect(listFolderBackgroundMenuActions('/Users/guest/Desktop', true)).toEqual([
      { actionId: 'new-folder', label: 'New Folder', isDisabled: false },
    ]);
    expect(listFolderBackgroundMenuActions('/Users/guest/.Trash/', false)).toEqual([
      { actionId: 'empty-trash', label: 'Empty Trash', isDisabled: false },
    ]);
    expect(listFolderBackgroundMenuActions('/Users/guest/.Trash', true)[0]?.isDisabled).toBe(true);
  });
});
