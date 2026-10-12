/** Path of the filesystem root. */
export const rootPath = '/';

/** The single visitor's home folder (everyone is the same "guest" user). */
export const homeFolderPath = '/Users/guest';

/** Folder whose contents are shown as icons on the desktop. */
export const desktopFolderPath = `${homeFolderPath}/Desktop`;

/** Hidden folder that holds items moved to the Trash. */
export const trashFolderPath = `${homeFolderPath}/.Trash`;

/** Name Finder shows for the root folder, like a Mac's startup disk. */
export const rootFolderDisplayName = 'Macintosh HD';

/** Name Finder shows for the Trash folder. */
export const trashFolderDisplayName = 'Trash';

/**
 * Splits an absolute path into its folder and file names, ignoring empty segments, `.` and resolving
 * `..` (which can never climb above the root).
 * @param absolutePath - A path starting with `/`, for example `/Users/guest/Desktop`.
 * @returns The path's names in order, for example `['Users', 'guest', 'Desktop']`.
 * @throws {Error} When the path is not absolute.
 */
export function splitPathIntoNames(absolutePath: string): string[] {
  const isAbsolutePath = absolutePath.startsWith('/');
  if (!isAbsolutePath) {
    throw new Error(`Expected an absolute path starting with "/", received "${absolutePath}".`);
  }

  const resolvedNames: string[] = [];
  for (const pathSegment of absolutePath.split('/')) {
    const isEmptyOrCurrentFolderSegment = pathSegment === '' || pathSegment === '.';
    if (isEmptyOrCurrentFolderSegment) {
      continue;
    }
    if (pathSegment === '..') {
      resolvedNames.pop();
      continue;
    }
    resolvedNames.push(pathSegment);
  }
  return resolvedNames;
}

/**
 * Rewrites an absolute path into its canonical form: single slashes, no `.`/`..`, no trailing slash.
 * @param absolutePath - The path to normalize.
 * @returns The canonical path, for example `/Users/guest` for `//Users/./guest/Desktop/../`.
 */
export function normalizePath(absolutePath: string): string {
  return `/${splitPathIntoNames(absolutePath).join('/')}`;
}

/**
 * Appends a child name to a folder path.
 * @param folderPath - The absolute folder path.
 * @param childName - The name of the item inside that folder.
 * @returns The normalized absolute path of the child.
 */
export function joinPath(folderPath: string, childName: string): string {
  return normalizePath(`${folderPath}/${childName}`);
}

/**
 * Returns the folder that contains a path.
 * @param absolutePath - The path of a file or folder.
 * @returns The parent folder's path (the root's parent is the root itself).
 */
export function getParentPath(absolutePath: string): string {
  const pathNames = splitPathIntoNames(absolutePath);
  return `/${pathNames.slice(0, -1).join('/')}`;
}

/**
 * Returns the last name in a path.
 * @param absolutePath - The path of a file or folder.
 * @returns The item's own name, or an empty string for the root.
 */
export function getBaseName(absolutePath: string): string {
  return splitPathIntoNames(absolutePath).at(-1) ?? '';
}

/**
 * Reports whether one path is the same as, or nested inside, another.
 * @param candidatePath - The path that might be inside the folder.
 * @param folderPath - The folder to check against.
 * @returns True when `candidatePath` equals `folderPath` or lives somewhere beneath it.
 */
export function isPathInsideFolder(candidatePath: string, folderPath: string): boolean {
  const normalizedCandidatePath = normalizePath(candidatePath);
  const normalizedFolderPath = normalizePath(folderPath);
  if (normalizedFolderPath === rootPath) {
    return true;
  }
  return (
    normalizedCandidatePath === normalizedFolderPath ||
    normalizedCandidatePath.startsWith(`${normalizedFolderPath}/`)
  );
}

/**
 * Checks that a single file or folder name is usable: not empty, not `.`/`..`, and without `/`.
 * @param candidateName - The proposed name.
 * @returns True when the name can be used for a file or folder.
 */
export function isValidItemName(candidateName: string): boolean {
  const trimmedName = candidateName.trim();
  const isReservedName = trimmedName === '.' || trimmedName === '..';
  return trimmedName !== '' && !isReservedName && !candidateName.includes('/');
}

/**
 * Reports whether an item is hidden from Finder and the desktop, like macOS dot-files (`.Trash`).
 * @param itemName - The item's name.
 * @returns True when the name starts with a dot.
 */
export function isHiddenItemName(itemName: string): boolean {
  return itemName.startsWith('.');
}

/**
 * Returns the name Finder shows for a folder: "Macintosh HD" for the root, "Trash" for the Trash,
 * and the folder's own name otherwise.
 * @param folderPath - Absolute path of the folder.
 * @returns The folder's display name.
 */
export function getFolderDisplayName(folderPath: string): string {
  const normalizedFolderPath = normalizePath(folderPath);
  if (normalizedFolderPath === rootPath) {
    return rootFolderDisplayName;
  }
  if (normalizedFolderPath === trashFolderPath) {
    return trashFolderDisplayName;
  }
  return getBaseName(normalizedFolderPath);
}

/**
 * Lists a path and every folder above it, starting at the root (for Finder's path bar and column
 * view).
 * @param itemPath - Absolute path of a file or folder.
 * @returns For `/Users/guest`: `['/', '/Users', '/Users/guest']`.
 */
export function listPathAndAncestors(itemPath: string): string[] {
  const pathNames = splitPathIntoNames(itemPath);
  return [rootPath, ...pathNames.map((_, nameIndex) => `/${pathNames.slice(0, nameIndex + 1).join('/')}`)];
}
