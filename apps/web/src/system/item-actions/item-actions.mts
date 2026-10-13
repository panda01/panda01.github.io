import type { FileSystemItem } from '../fs/file-system.types.mts';
import {
  getParentPath,
  isPathInsideFolder,
  joinPath,
  normalizePath,
  trashFolderPath,
} from '../fs/path-utilities.mts';
import type { VirtualFileSystem } from '../fs/virtual-file-system.mts';

/** Name macOS gives a new folder before the visitor renames it. */
export const untitledFolderName = 'untitled folder';

/** How long a download's temporary address stays valid; revoking it at once can cancel the download. */
const downloadUrlLifetimeInMilliseconds = 60_000;

/**
 * Creates a new folder named "untitled folder" (or "untitled folder 2", ...) in a folder.
 * @param fileSystem - The visitor's filesystem.
 * @param parentFolderPath - Where to create the folder.
 * @returns The new folder.
 */
export async function createUntitledFolder(
  fileSystem: VirtualFileSystem,
  parentFolderPath: string,
): Promise<FileSystemItem> {
  const availableFolderName = await fileSystem.createUniqueChildName(
    parentFolderPath,
    untitledFolderName,
    'folder',
  );
  return fileSystem.createFolder(joinPath(parentFolderPath, availableFolderName));
}

/**
 * Opens a web address in a new browser tab without giving that page access to this one.
 * @param url - The address to open.
 */
export function openUrlInNewBrowserTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** What opening an item does. */
export type ItemOpeningPlan =
  | { kind: 'show-folder'; folderPath: string }
  | { kind: 'preview-file'; filePath: string }
  | { kind: 'open-url'; url: string }
  | { kind: 'missing-original'; aliasName: string };

/**
 * Decides what opening an item does, the way Finder does: folders open in Finder, files open in
 * Quick Look (the only viewer so far), web and email links open in a new browser tab, and an alias
 * opens its original.
 * @param item - The item being opened.
 * @param aliasOriginal - For an alias, the item it points to (undefined when that item is gone).
 * @returns The opening plan.
 */
export function planItemOpening(
  item: FileSystemItem,
  aliasOriginal: FileSystemItem | undefined,
): ItemOpeningPlan {
  if (item.kind === 'folder') {
    return { kind: 'show-folder', folderPath: item.path };
  }
  if (item.kind === 'file') {
    return { kind: 'preview-file', filePath: item.path };
  }
  if (item.linkTarget?.kind === 'url') {
    return { kind: 'open-url', url: item.linkTarget.url };
  }
  if (aliasOriginal === undefined) {
    return { kind: 'missing-original', aliasName: item.name };
  }
  // Aliases are followed one step only, so an alias pointing at another alias cannot loop forever.
  return planItemOpening(aliasOriginal, undefined);
}

/**
 * Looks up an alias's original (if the item is an alias) and decides what opening the item does.
 * @param fileSystem - The visitor's filesystem.
 * @param item - The item being opened.
 * @returns The opening plan.
 */
export async function resolveItemOpeningPlan(
  fileSystem: VirtualFileSystem,
  item: FileSystemItem,
): Promise<ItemOpeningPlan> {
  const aliasOriginalPath = item.linkTarget?.kind === 'path' ? item.linkTarget.path : undefined;
  const aliasOriginal =
    aliasOriginalPath === undefined ? undefined : await fileSystem.findItem(aliasOriginalPath);
  return planItemOpening(item, aliasOriginal);
}

/**
 * Saves a copy of a file to the visitor's computer through the browser's normal download. This is
 * the only way files leave the site; nothing can be uploaded.
 * @param fileSystem - The visitor's filesystem.
 * @param filePath - Absolute path of the file to download.
 * @param pageDocument - The page document (replaceable in tests).
 * @returns Resolves once the download has been handed to the browser.
 * @throws {WrongItemKindError} When the path is not a file (folders cannot be downloaded).
 */
export async function downloadFileToComputer(
  fileSystem: VirtualFileSystem,
  filePath: string,
  pageDocument: Document = document,
): Promise<void> {
  const fileBytes = await fileSystem.readFileBytes(filePath);
  const fileItem = await fileSystem.getItem(filePath);
  const downloadUrl = URL.createObjectURL(new Blob([fileBytes], { type: fileItem.mimeType }));
  const downloadLink = pageDocument.createElement('a');
  downloadLink.href = downloadUrl;
  downloadLink.download = fileItem.name;
  pageDocument.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  setTimeout(() => {
    URL.revokeObjectURL(downloadUrl);
  }, downloadUrlLifetimeInMilliseconds);
}

/** Where a dragged item can be dropped: into a folder, or onto the Trash. */
export type FileDropDestination = { kind: 'folder'; folderPath: string } | { kind: 'trash' };

/** What dropping an item does. */
export type FileDropOperation = 'move' | 'move-to-trash' | 'none';

/**
 * Decides what dropping a dragged item onto a destination does. Dropping into the Trash (its Dock
 * icon, its sidebar entry, or an open Trash window) moves the item to the Trash so it can be put
 * back later. Dropping where the item already is, or a folder into itself, does nothing.
 * @param draggedItem - The item being dragged.
 * @param dropDestination - Where it is being dropped.
 * @returns The operation to perform.
 */
export function decideFileDropOperation(
  draggedItem: FileSystemItem,
  dropDestination: FileDropDestination,
): FileDropOperation {
  const isDraggedItemInTrash = isPathInsideFolder(draggedItem.path, trashFolderPath);
  const isTrashDestination =
    dropDestination.kind === 'trash' ||
    isPathInsideFolder(dropDestination.folderPath, trashFolderPath);
  if (isTrashDestination) {
    return isDraggedItemInTrash ? 'none' : 'move-to-trash';
  }
  const destinationFolderPath = normalizePath(dropDestination.folderPath);
  const isAlreadyInDestination = getParentPath(draggedItem.path) === destinationFolderPath;
  const isDestinationInsideDraggedItem = isPathInsideFolder(
    destinationFolderPath,
    draggedItem.path,
  );
  if (isAlreadyInDestination || isDestinationInsideDraggedItem) {
    return 'none';
  }
  return 'move';
}

/**
 * Carries out a drop decided by `decideFileDropOperation`.
 * @param fileSystem - The visitor's filesystem.
 * @param draggedItem - The item that was dropped.
 * @param dropDestination - Where it was dropped.
 * @returns The operation that was performed.
 */
export async function performFileDrop(
  fileSystem: VirtualFileSystem,
  draggedItem: FileSystemItem,
  dropDestination: FileDropDestination,
): Promise<FileDropOperation> {
  const dropOperation = decideFileDropOperation(draggedItem, dropDestination);
  if (dropOperation === 'move-to-trash') {
    await fileSystem.moveToTrash(draggedItem.path);
  } else if (dropOperation === 'move' && dropDestination.kind === 'folder') {
    await fileSystem.move(draggedItem.path, dropDestination.folderPath);
  }
  return dropOperation;
}

/**
 * Renames an item from an inline name field. Leaving the name empty or unchanged keeps the old
 * name, like Finder.
 * @param fileSystem - The visitor's filesystem.
 * @param item - The item being renamed.
 * @param requestedName - What the visitor typed.
 * @returns The renamed item, or undefined when nothing changed.
 */
export async function renameItemFromField(
  fileSystem: VirtualFileSystem,
  item: FileSystemItem,
  requestedName: string,
): Promise<FileSystemItem | undefined> {
  const trimmedName = requestedName.trim();
  const isNameUnchanged = trimmedName === '' || trimmedName === item.name;
  if (isNameUnchanged) {
    return undefined;
  }
  return fileSystem.rename(item.path, trimmedName);
}
