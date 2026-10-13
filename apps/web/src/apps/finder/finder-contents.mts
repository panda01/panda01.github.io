import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { describeItemKind } from '../../system/fs/item-presentation.mts';
import {
  homeFolderPath,
  isHiddenItemName,
  isPathInsideFolder,
  listPathAndAncestors,
  normalizePath,
  splitPathIntoNames,
  trashFolderPath,
} from '../../system/fs/path-utilities.mts';

/** Finder's three ways of showing a folder. */
export type FinderViewMode = 'icons' | 'list' | 'columns';

/** The columns list view can sort by. */
export type FinderSortColumn = 'name' | 'modified' | 'size' | 'kind';

/** How list view is sorted. */
export interface FinderSortOrder {
  column: FinderSortColumn;
  direction: 'ascending' | 'descending';
}

/** List view's starting order: by name, A to Z. */
export const defaultFinderSortOrder: FinderSortOrder = { column: 'name', direction: 'ascending' };

/**
 * Compares two names the way Finder does: case-insensitively, with numbers compared by value.
 * @param firstName - One name.
 * @param secondName - The other name.
 * @returns A negative, zero or positive number for sorting.
 */
function compareNames(firstName: string, secondName: string): number {
  return firstName.localeCompare(secondName, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Removes hidden items (names starting with a dot, like `.Trash`), which Finder never shows.
 * @param folderItems - A folder's items.
 * @returns The items Finder shows.
 */
export function listVisibleItems(folderItems: readonly FileSystemItem[]): FileSystemItem[] {
  return folderItems.filter((folderItem) => !isHiddenItemName(folderItem.name));
}

/**
 * Sorts items for list view. Ties are broken by name; folders count as having no size.
 * @param folderItems - The items to sort.
 * @param sortOrder - Which column, in which direction.
 * @returns A sorted copy.
 */
export function sortItemsForListView(
  folderItems: readonly FileSystemItem[],
  sortOrder: FinderSortOrder,
): FileSystemItem[] {
  const directionMultiplier = sortOrder.direction === 'ascending' ? 1 : -1;
  /**
   * Compares two items by the chosen column only.
   * @param firstItem - One item.
   * @param secondItem - The other item.
   * @returns A negative, zero or positive number.
   */
  function compareByColumn(firstItem: FileSystemItem, secondItem: FileSystemItem): number {
    switch (sortOrder.column) {
      case 'name':
        return compareNames(firstItem.name, secondItem.name);
      case 'modified':
        return firstItem.modifiedAt - secondItem.modifiedAt;
      case 'size':
        return measureSortableSize(firstItem) - measureSortableSize(secondItem);
      case 'kind':
        return compareNames(describeItemKind(firstItem), describeItemKind(secondItem));
    }
  }
  return [...folderItems].sort((firstItem, secondItem) => {
    const columnComparison = directionMultiplier * compareByColumn(firstItem, secondItem);
    const isTieInColumn = columnComparison === 0;
    return isTieInColumn ? compareNames(firstItem.name, secondItem.name) : columnComparison;
  });
}

/**
 * Gives an item a size to sort by: files by their byte size, folders and links before any file.
 * @param item - The item.
 * @returns Its sortable size.
 */
function measureSortableSize(item: FileSystemItem): number {
  return item.kind === 'file' ? item.sizeInBytes : -1;
}

/**
 * Finder's search: finds items anywhere inside a folder (including its subfolders) whose name
 * contains the search text, ignoring case. Hidden items and anything inside a hidden folder are
 * left out, unless the search starts inside that hidden folder (searching the Trash finds trashed
 * items).
 * @param allItems - Every item in the filesystem.
 * @param folderPath - The folder to search.
 * @param searchText - What to look for.
 * @returns The matching items, sorted by name.
 */
export function searchItemsInFolder(
  allItems: readonly FileSystemItem[],
  folderPath: string,
  searchText: string,
): FileSystemItem[] {
  const normalizedFolderPath = normalizePath(folderPath);
  const lowercaseSearchText = searchText.trim().toLocaleLowerCase();
  const searchedFolderDepth = splitPathIntoNames(normalizedFolderPath).length;
  return allItems
    .filter((candidateItem) => {
      const isInsideSearchedFolder =
        candidateItem.path !== normalizedFolderPath &&
        isPathInsideFolder(candidateItem.path, normalizedFolderPath);
      const namesBelowSearchedFolder = splitPathIntoNames(candidateItem.path).slice(
        searchedFolderDepth,
      );
      const isHiddenOrInsideHiddenFolder = namesBelowSearchedFolder.some(isHiddenItemName);
      const isNameMatch = candidateItem.name.toLocaleLowerCase().includes(lowercaseSearchText);
      return isInsideSearchedFolder && !isHiddenOrInsideHiddenFolder && isNameMatch;
    })
    .sort((firstItem, secondItem) => compareNames(firstItem.name, secondItem.name));
}

/**
 * Lists the folders column view shows side by side, ending with the current folder. Columns start
 * at the home folder for anything inside it (like Finder windows that start at a favourite), at
 * the Trash for the Trash, and at the root otherwise.
 * @param currentFolderPath - The folder shown now.
 * @returns The column folders, left to right.
 */
export function listColumnFolderPaths(currentFolderPath: string): string[] {
  const normalizedCurrentPath = normalizePath(currentFolderPath);
  let columnRootPath = '/';
  if (isPathInsideFolder(normalizedCurrentPath, trashFolderPath)) {
    columnRootPath = trashFolderPath;
  } else if (isPathInsideFolder(normalizedCurrentPath, homeFolderPath)) {
    columnRootPath = homeFolderPath;
  }
  return listPathAndAncestors(normalizedCurrentPath).filter((ancestorPath) =>
    isPathInsideFolder(ancestorPath, columnRootPath),
  );
}

/**
 * Describes how many items a folder shows, for the status at the bottom of a Finder window.
 * @param itemCount - The number of items.
 * @returns For example "1 item" or "5 items".
 */
export function describeItemCount(itemCount: number): string {
  return `${String(itemCount)} item${itemCount === 1 ? '' : 's'}`;
}
