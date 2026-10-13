import type { FileSystemItem } from '../fs/file-system.types.mts';
import { getParentPath, normalizePath, trashFolderPath } from '../fs/path-utilities.mts';

/** Actions offered when a file, folder or link is right-clicked (on the desktop or in Finder). */
export type ItemMenuActionId =
  | 'open'
  | 'quick-look'
  | 'get-info'
  | 'rename'
  | 'duplicate'
  | 'download'
  | 'move-to-trash'
  | 'put-back'
  | 'delete-immediately';

/** Actions offered when empty space in a folder (or on the desktop) is right-clicked. */
export type FolderBackgroundMenuActionId = 'new-folder' | 'empty-trash';

/** One entry of a right-click menu. */
export interface ItemMenuAction<MenuActionId extends string> {
  actionId: MenuActionId;
  label: string;
  isDisabled: boolean;
  /** Draws a separator line above this entry. */
  hasDividerBefore?: boolean;
}

/**
 * Lists the right-click menu for an item. Items in the Trash offer Put Back and Delete Immediately;
 * everything else offers Open, Quick Look, Get Info, Rename, Duplicate, Download (files only) and
 * Move to Trash. There is never an upload entry: visitors can only download.
 * @param item - The right-clicked item.
 * @returns The menu entries, top to bottom.
 */
export function listItemMenuActions(item: FileSystemItem): ItemMenuAction<ItemMenuActionId>[] {
  const isDirectlyInTrash = getParentPath(item.path) === normalizePath(trashFolderPath);
  if (isDirectlyInTrash) {
    return [
      { actionId: 'put-back', label: 'Put Back', isDisabled: false },
      { actionId: 'delete-immediately', label: 'Delete Immediately', isDisabled: false },
      { actionId: 'quick-look', label: 'Quick Look', isDisabled: false, hasDividerBefore: true },
      { actionId: 'get-info', label: 'Get Info', isDisabled: false },
    ];
  }
  return [
    { actionId: 'open', label: 'Open', isDisabled: false },
    { actionId: 'quick-look', label: 'Quick Look', isDisabled: false },
    { actionId: 'get-info', label: 'Get Info', isDisabled: false, hasDividerBefore: true },
    { actionId: 'rename', label: 'Rename', isDisabled: false },
    { actionId: 'duplicate', label: 'Duplicate', isDisabled: false },
    ...(item.kind === 'file'
      ? [{ actionId: 'download' as const, label: 'Download', isDisabled: false }]
      : []),
    {
      actionId: 'move-to-trash',
      label: 'Move to Trash',
      isDisabled: false,
      hasDividerBefore: true,
    },
  ];
}

/**
 * Lists the right-click menu for empty space in a folder: New Folder, or Empty Trash inside the
 * Trash.
 * @param folderPath - The folder whose empty space was right-clicked.
 * @param isFolderEmpty - Whether the folder has no items (Empty Trash is then unavailable).
 * @returns The menu entries, top to bottom.
 */
export function listFolderBackgroundMenuActions(
  folderPath: string,
  isFolderEmpty: boolean,
): ItemMenuAction<FolderBackgroundMenuActionId>[] {
  const isTrashFolder = normalizePath(folderPath) === normalizePath(trashFolderPath);
  if (isTrashFolder) {
    return [{ actionId: 'empty-trash', label: 'Empty Trash', isDisabled: isFolderEmpty }];
  }
  return [{ actionId: 'new-folder', label: 'New Folder', isDisabled: false }];
}
