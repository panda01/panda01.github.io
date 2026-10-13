import { describe, expect, it } from 'vitest';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import {
  defaultFinderSortOrder,
  describeItemCount,
  listColumnFolderPaths,
  listVisibleItems,
  searchItemsInFolder,
  sortItemsForListView,
} from './finder-contents.mts';
import {
  canGoBack,
  canGoForward,
  createFinderNavigationState,
  finderNavigationReducer,
  selectCurrentFolderPath,
} from './finder-navigation.mts';

/**
 * Builds a filesystem item from a path, with sensible defaults.
 * @param itemPath - The item's path (its name is the last part).
 * @param overrides - Fields to change.
 * @returns The item.
 */
function buildItem(itemPath: string, overrides: Partial<FileSystemItem> = {}): FileSystemItem {
  return {
    id: itemPath,
    parentId: 'p',
    name: itemPath.slice(itemPath.lastIndexOf('/') + 1),
    path: itemPath,
    kind: 'file',
    mimeType: 'text/plain',
    sizeInBytes: 10,
    createdAt: 0,
    modifiedAt: 0,
    ...overrides,
  };
}

describe('Finder navigation history', () => {
  it('goes back and forward like a browser, dropping forward history on a new folder', () => {
    let navigationState = createFinderNavigationState('/Users/guest/');
    expect(selectCurrentFolderPath(navigationState)).toBe('/Users/guest');
    expect(canGoBack(navigationState)).toBe(false);

    navigationState = finderNavigationReducer(navigationState, {
      type: 'show-folder',
      folderPath: '/Users/guest/Projects',
    });
    navigationState = finderNavigationReducer(navigationState, {
      type: 'show-folder',
      folderPath: '/Users/guest/Projects/One',
    });
    navigationState = finderNavigationReducer(navigationState, { type: 'go-back' });
    expect(selectCurrentFolderPath(navigationState)).toBe('/Users/guest/Projects');
    expect(canGoForward(navigationState)).toBe(true);

    navigationState = finderNavigationReducer(navigationState, {
      type: 'show-folder',
      folderPath: '/Users/guest/Documents',
    });
    expect(navigationState.visitedFolderPaths).toEqual([
      '/Users/guest',
      '/Users/guest/Projects',
      '/Users/guest/Documents',
    ]);
    expect(canGoForward(navigationState)).toBe(false);
  });

  it('changes nothing when showing the current folder or going past either end', () => {
    const navigationState = createFinderNavigationState('/Users/guest');

    expect(
      finderNavigationReducer(navigationState, { type: 'show-folder', folderPath: '/Users/guest' }),
    ).toBe(navigationState);
    expect(finderNavigationReducer(navigationState, { type: 'go-back' })).toBe(navigationState);
    expect(finderNavigationReducer(navigationState, { type: 'go-forward' })).toBe(navigationState);
    expect(selectCurrentFolderPath({ visitedFolderPaths: [], currentIndex: 0 })).toBe('/');
  });
});

describe('Finder folder contents', () => {
  it('hides dot-files', () => {
    expect(
      listVisibleItems([buildItem('/Users/guest/.Trash'), buildItem('/Users/guest/Desktop')]).map(
        (item) => item.name,
      ),
    ).toEqual(['Desktop']);
  });

  it('sorts list view by any column in either direction, breaking ties by name', () => {
    const folderItems = [
      buildItem('/a/b.txt', { modifiedAt: 3, sizeInBytes: 5 }),
      buildItem('/a/A folder', { kind: 'folder', mimeType: 'inode/directory', modifiedAt: 1 }),
      buildItem('/a/c.pdf', { mimeType: 'application/pdf', modifiedAt: 2, sizeInBytes: 50 }),
      buildItem('/a/item 10.txt', { modifiedAt: 2, sizeInBytes: 5 }),
    ];

    /**
     * Sorts the sample items and lists their names.
     * @param column - Column to sort by.
     * @param direction - Sort direction.
     * @returns The names in sorted order.
     */
    function sortedNames(
      column: 'name' | 'modified' | 'size' | 'kind',
      direction: 'ascending' | 'descending',
    ): string[] {
      return sortItemsForListView(folderItems, { column, direction }).map((item) => item.name);
    }

    expect(
      sortItemsForListView(folderItems, defaultFinderSortOrder).map((item) => item.name),
    ).toEqual(['A folder', 'b.txt', 'c.pdf', 'item 10.txt']);
    expect(sortedNames('name', 'descending')).toEqual([
      'item 10.txt',
      'c.pdf',
      'b.txt',
      'A folder',
    ]);
    expect(sortedNames('modified', 'ascending')).toEqual([
      'A folder',
      'c.pdf',
      'item 10.txt',
      'b.txt',
    ]);
    expect(sortedNames('size', 'descending')).toEqual([
      'c.pdf',
      'b.txt',
      'item 10.txt',
      'A folder',
    ]);
    expect(sortedNames('kind', 'ascending')).toEqual(['A folder', 'c.pdf', 'b.txt', 'item 10.txt']);
  });

  it('searches a folder and its subfolders by name, skipping hidden items', () => {
    const allItems = [
      buildItem('/Users/guest/Projects'),
      buildItem('/Users/guest/Projects/One/README.txt'),
      buildItem('/Users/guest/Projects/Two/readme notes.txt'),
      buildItem('/Users/guest/Desktop/README.txt'),
      buildItem('/Users/guest/Projects/.cache/README.txt'),
      buildItem('/Users/guest/.Trash/Old README.txt'),
    ];

    expect(
      searchItemsInFolder(allItems, '/Users/guest/Projects', ' readme ').map((item) => item.path),
    ).toEqual([
      '/Users/guest/Projects/Two/readme notes.txt',
      '/Users/guest/Projects/One/README.txt',
    ]);
    expect(searchItemsInFolder(allItems, '/Users/guest', 'old')).toEqual([]);
    expect(
      searchItemsInFolder(allItems, '/Users/guest/.Trash', 'readme').map((item) => item.name),
    ).toEqual(['Old README.txt']);
  });

  it('starts column view at the home folder, the Trash, or the root', () => {
    expect(listColumnFolderPaths('/Users/guest/Projects/One')).toEqual([
      '/Users/guest',
      '/Users/guest/Projects',
      '/Users/guest/Projects/One',
    ]);
    expect(listColumnFolderPaths('/Users/guest/.Trash')).toEqual(['/Users/guest/.Trash']);
    expect(listColumnFolderPaths('/Users')).toEqual(['/', '/Users']);
  });
});

describe('describeItemCount', () => {
  it('counts items in English', () => {
    expect(describeItemCount(0)).toBe('0 items');
    expect(describeItemCount(1)).toBe('1 item');
    expect(describeItemCount(5)).toBe('5 items');
  });
});
