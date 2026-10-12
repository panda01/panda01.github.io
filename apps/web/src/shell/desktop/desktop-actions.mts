import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { joinPath } from '../../system/fs/path-utilities.mts';
import type { VirtualFileSystem } from '../../system/fs/virtual-file-system.mts';

/** Name macOS gives a new folder before the visitor renames it. */
export const untitledFolderName = 'untitled folder';

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
 * Reports whether an item can be opened with what exists so far. Web and email links open in a
 * new browser tab; files, folders and aliases open in Finder and Quick Look from Phase 2.
 * @param item - The item to open.
 * @returns True when opening the item does something.
 */
export function canOpenItem(item: FileSystemItem): boolean {
  return item.kind === 'link' && item.linkTarget?.kind === 'url';
}

/**
 * Opens an item if it can be opened (see `canOpenItem`).
 * @param item - The item to open.
 * @param openUrlInNewTab - Opens a web address in a new browser tab.
 * @returns True when something was opened.
 */
export function openDesktopItem(
  item: FileSystemItem,
  openUrlInNewTab: (url: string) => void,
): boolean {
  if (!canOpenItem(item) || item.linkTarget?.kind !== 'url') {
    return false;
  }
  openUrlInNewTab(item.linkTarget.url);
  return true;
}

/**
 * Opens a web address in a new browser tab without giving that page access to this one.
 * @param url - The address to open.
 */
export function openUrlInNewBrowserTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
