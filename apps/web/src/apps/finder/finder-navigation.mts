import { normalizePath } from '../../system/fs/path-utilities.mts';

/** A Finder window's history of folders, for the Back and Forward buttons. */
export interface FinderNavigationState {
  /** Folders visited, oldest first. */
  visitedFolderPaths: readonly string[];
  /** Index of the folder shown now. */
  currentIndex: number;
}

/** Something that changes which folder a Finder window shows. */
export type FinderNavigationAction =
  { type: 'show-folder'; folderPath: string } | { type: 'go-back' } | { type: 'go-forward' };

/**
 * Starts a Finder window's history.
 * @param initialFolderPath - The folder the window opens on.
 * @returns History holding just that folder.
 */
export function createFinderNavigationState(initialFolderPath: string): FinderNavigationState {
  return { visitedFolderPaths: [normalizePath(initialFolderPath)], currentIndex: 0 };
}

/**
 * Applies a navigation action, like a browser's history: showing a new folder drops any "forward"
 * folders; Back and Forward move through the history and stop at either end.
 * @param navigationState - The current history.
 * @param navigationAction - What happened.
 * @returns The new history (the same object when nothing changes).
 */
export function finderNavigationReducer(
  navigationState: FinderNavigationState,
  navigationAction: FinderNavigationAction,
): FinderNavigationState {
  switch (navigationAction.type) {
    case 'show-folder': {
      const folderPathToShow = normalizePath(navigationAction.folderPath);
      if (folderPathToShow === selectCurrentFolderPath(navigationState)) {
        return navigationState;
      }
      return {
        visitedFolderPaths: [
          ...navigationState.visitedFolderPaths.slice(0, navigationState.currentIndex + 1),
          folderPathToShow,
        ],
        currentIndex: navigationState.currentIndex + 1,
      };
    }
    case 'go-back':
      return canGoBack(navigationState)
        ? { ...navigationState, currentIndex: navigationState.currentIndex - 1 }
        : navigationState;
    case 'go-forward':
      return canGoForward(navigationState)
        ? { ...navigationState, currentIndex: navigationState.currentIndex + 1 }
        : navigationState;
  }
}

/**
 * Reads the folder shown now.
 * @param navigationState - The window's history.
 * @returns The current folder's path.
 */
export function selectCurrentFolderPath(navigationState: FinderNavigationState): string {
  return navigationState.visitedFolderPaths[navigationState.currentIndex] ?? '/';
}

/**
 * Reports whether Back is available.
 * @param navigationState - The window's history.
 * @returns True when an earlier folder exists.
 */
export function canGoBack(navigationState: FinderNavigationState): boolean {
  return navigationState.currentIndex > 0;
}

/**
 * Reports whether Forward is available.
 * @param navigationState - The window's history.
 * @returns True when a later folder exists.
 */
export function canGoForward(navigationState: FinderNavigationState): boolean {
  return navigationState.currentIndex < navigationState.visitedFolderPaths.length - 1;
}
