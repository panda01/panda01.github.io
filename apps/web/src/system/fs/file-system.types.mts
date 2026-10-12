/** The three kinds of items the virtual filesystem stores. */
export type FileSystemItemKind = 'folder' | 'file' | 'link';

/**
 * Where a link points: a web address (opened in the Browser app) or another item in the virtual
 * filesystem (a macOS-style alias).
 */
export type LinkTarget = { kind: 'url'; url: string } | { kind: 'path'; path: string };

/**
 * One file, folder or link as stored in IndexedDB. Items reference their parent by id, so renaming
 * or moving a folder never has to rewrite its descendants.
 */
export interface FileSystemNodeRecord {
  /** Stable unique id. The root folder's id is "root". */
  id: string;
  /** Id of the containing folder; the root folder's parent id is an empty string. */
  parentId: string;
  /** The item's name inside its folder (unique among its siblings). */
  name: string;
  kind: FileSystemItemKind;
  /** MIME type of a file's content; folders use "inode/directory" and links "application/x-link". */
  mimeType: string;
  /** Size of a file's content in bytes (0 for folders and links). */
  sizeInBytes: number;
  /** File content. Stored as bytes because Blobs do not survive IndexedDB under jsdom (Phase 0 spike). */
  content?: Uint8Array;
  /** Where a link points (links only). */
  linkTarget?: LinkTarget;
  /** Creation time in milliseconds since the Unix epoch. */
  createdAt: number;
  /** Last content or name change in milliseconds since the Unix epoch. */
  modifiedAt: number;
  /** Fingerprint of the content this item was seeded with, used to detect whether the visitor changed it. */
  seedFingerprint?: string;
  /** For items in the Trash: the folder they were deleted from, so "Put Back" can restore them. */
  trashedFromFolderPath?: string;
  /** For items in the Trash: their name before trashing (it may have been numbered to avoid a clash). */
  nameBeforeTrash?: string;
}

/** A filesystem item together with its absolute path, as returned to the rest of the app. */
export interface FileSystemItem extends FileSystemNodeRecord {
  path: string;
}
