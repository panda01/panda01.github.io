import type { DesktopDatabase } from '../storage/desktop-database.mts';
import {
  FileAlreadyExistsError,
  FileNotFoundError,
  InvalidFileOperationError,
  StorageQuotaExceededError,
  WrongItemKindError,
  isQuotaExceededError,
} from './file-system-errors.mts';
import type {
  FileSystemItem,
  FileSystemItemKind,
  FileSystemNodeRecord,
  LinkTarget,
} from './file-system.types.mts';
import {
  folderMimeType,
  guessMimeTypeFromFileName,
  linkMimeType,
  splitNameAndExtension,
} from './mime-types.mts';
import {
  getBaseName,
  getParentPath,
  isPathInsideFolder,
  isValidItemName,
  joinPath,
  normalizePath,
  rootPath,
  splitPathIntoNames,
  trashFolderPath,
} from './path-utilities.mts';

/** Id of the root folder record. */
export const rootFolderId = 'root';

/**
 * Builds the n-th candidate name when a name is taken, macOS-style: "untitled folder",
 * "untitled folder 2", or for files "Notes.txt", "Notes 2.txt".
 * @param desiredName - The name the caller wanted.
 * @param attemptNumber - 1 for the desired name itself, 2+ for numbered alternatives.
 * @param itemKind - Files keep their extension at the end; folders and links do not have one.
 * @returns The candidate name for this attempt.
 */
export function buildNumberedName(
  desiredName: string,
  attemptNumber: number,
  itemKind: FileSystemItemKind,
): string {
  if (attemptNumber === 1) {
    return desiredName;
  }
  if (itemKind !== 'file') {
    return `${desiredName} ${String(attemptNumber)}`;
  }
  const { stem, extension } = splitNameAndExtension(desiredName);
  return `${stem} ${String(attemptNumber)}${extension}`;
}

/**
 * Builds the n-th candidate name for a duplicate, macOS-style: "Notes copy.txt", "Notes copy 2.txt".
 * @param originalName - The name of the item being copied.
 * @param attemptNumber - 1 for the first copy name, 2+ for numbered copies.
 * @param itemKind - Files keep their extension at the end.
 * @returns The candidate copy name for this attempt.
 */
export function buildCopyName(
  originalName: string,
  attemptNumber: number,
  itemKind: FileSystemItemKind,
): string {
  const { stem, extension } =
    itemKind === 'file'
      ? splitNameAndExtension(originalName)
      : { stem: originalName, extension: '' };
  const copySuffix = attemptNumber === 1 ? ' copy' : ` copy ${String(attemptNumber)}`;
  return `${stem}${copySuffix}${extension}`;
}

/**
 * Creates a unique item id. Uses `crypto.getRandomValues`, which (unlike `randomUUID`) also works on
 * plain-HTTP LAN addresses used when testing on a phone.
 * @returns A short random id such as "lz9k2c1a-3f9a1c0b7e2d4a6f".
 */
export function createRandomItemId(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(8));
  const randomHex = Array.from(randomBytes, (randomByte) =>
    randomByte.toString(16).padStart(2, '0'),
  ).join('');
  return `${Date.now().toString(36)}-${randomHex}`;
}

/** Replaceable sources of time and ids, so tests can be deterministic. */
export interface VirtualFileSystemDependencies {
  getCurrentTime: () => number;
  createItemId: () => string;
}

/**
 * Orders items the way Finder does: case-insensitively, with numbers compared by value.
 * @param firstItem - One item.
 * @param secondItem - The other item.
 * @returns A negative, zero or positive number for sorting.
 */
function compareItemsByName(
  firstItem: FileSystemNodeRecord,
  secondItem: FileSystemNodeRecord,
): number {
  return firstItem.name.localeCompare(secondItem.name, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * The visitor's filesystem (files, folders, links, Trash) stored in IndexedDB. Every app — the
 * desktop, Finder, and Terminal — goes through this service, so they always agree.
 */
export class VirtualFileSystem {
  private readonly getCurrentTime: () => number;
  private readonly createItemId: () => string;

  /**
   * Creates the service on top of an opened desktop database.
   * @param database - The visitor's desktop database.
   * @param dependencies - Optional replacements for the clock and id generator.
   */
  constructor(
    private readonly database: DesktopDatabase,
    dependencies: Partial<VirtualFileSystemDependencies> = {},
  ) {
    this.getCurrentTime = dependencies.getCurrentTime ?? Date.now;
    this.createItemId = dependencies.createItemId ?? createRandomItemId;
  }

  /**
   * Creates the root folder if this is a brand-new database.
   * @returns Resolves once the root folder exists.
   */
  async ensureRootFolder(): Promise<void> {
    const existingRootFolder = await this.database.nodes.get(rootFolderId);
    if (existingRootFolder !== undefined) {
      return;
    }
    const creationTime = this.getCurrentTime();
    await this.runWrite(() =>
      this.database.nodes.add({
        id: rootFolderId,
        parentId: '',
        name: '',
        kind: 'folder',
        mimeType: folderMimeType,
        sizeInBytes: 0,
        createdAt: creationTime,
        modifiedAt: creationTime,
      }),
    );
  }

  /**
   * Looks up an item by path without throwing.
   * @param itemPath - Absolute path of the item.
   * @returns The item, or undefined when nothing exists at that path.
   */
  async findItem(itemPath: string): Promise<FileSystemItem | undefined> {
    const foundRecord = await this.findRecordByPath(itemPath);
    return foundRecord === undefined ? undefined : toItem(foundRecord, itemPath);
  }

  /**
   * Looks up an item by path.
   * @param itemPath - Absolute path of the item.
   * @returns The item.
   * @throws {FileNotFoundError} When nothing exists at that path.
   */
  async getItem(itemPath: string): Promise<FileSystemItem> {
    return toItem(await this.requireRecord(itemPath), itemPath);
  }

  /**
   * Reports whether anything exists at a path.
   * @param itemPath - Absolute path to check.
   * @returns True when a file, folder or link exists there.
   */
  async exists(itemPath: string): Promise<boolean> {
    return (await this.findRecordByPath(itemPath)) !== undefined;
  }

  /**
   * Lists a folder's contents in Finder order.
   * @param folderPath - Absolute path of the folder.
   * @returns The folder's children, sorted by name.
   * @throws {FileNotFoundError | WrongItemKindError} When the folder is missing or is not a folder.
   */
  async listFolder(folderPath: string): Promise<FileSystemItem[]> {
    const folderRecord = await this.requireFolderRecord(folderPath);
    const childRecords = await this.database.nodes
      .where('parentId')
      .equals(folderRecord.id)
      .toArray();
    return childRecords
      .sort(compareItemsByName)
      .map((childRecord) => toItem(childRecord, joinPath(folderPath, childRecord.name)));
  }

  /**
   * Lists every item in the filesystem with its path, without file contents (for Spotlight and
   * Finder's search, which only need names and paths).
   * @returns Every item except the root folder, in no particular order.
   */
  async listAllItems(): Promise<FileSystemItem[]> {
    const allRecords = await this.database.nodes.toArray();
    const recordsById = new Map(allRecords.map((nodeRecord) => [nodeRecord.id, nodeRecord]));
    const resolvedPathsById = new Map<string, string>([[rootFolderId, rootPath]]);

    /**
     * Works out a record's path by walking up its parents (remembering every path it finds).
     * @param nodeRecord - The record to place.
     * @returns Its absolute path, or undefined when a parent is missing.
     */
    function resolveRecordPath(nodeRecord: FileSystemNodeRecord): string | undefined {
      const unresolvedChain: FileSystemNodeRecord[] = [];
      let currentRecord: FileSystemNodeRecord | undefined = nodeRecord;
      while (currentRecord !== undefined && !resolvedPathsById.has(currentRecord.id)) {
        const isParentLoop = unresolvedChain.includes(currentRecord);
        if (isParentLoop) {
          return undefined;
        }
        unresolvedChain.push(currentRecord);
        currentRecord = recordsById.get(currentRecord.parentId);
      }
      if (currentRecord === undefined) {
        return undefined;
      }
      let resolvedPath = resolvedPathsById.get(currentRecord.id) ?? rootPath;
      for (const chainRecord of unresolvedChain.reverse()) {
        resolvedPath = joinPath(resolvedPath, chainRecord.name);
        resolvedPathsById.set(chainRecord.id, resolvedPath);
      }
      return resolvedPath;
    }

    return allRecords.flatMap((nodeRecord) => {
      const recordPath = nodeRecord.id === rootFolderId ? undefined : resolveRecordPath(nodeRecord);
      if (recordPath === undefined) {
        return [];
      }
      const itemWithoutContent = toItem(nodeRecord, recordPath);
      delete itemWithoutContent.content;
      return [itemWithoutContent];
    });
  }

  /**
   * Creates a folder.
   * @param folderPath - Absolute path of the new folder.
   * @param options - `createMissingParents` creates any missing parent folders and tolerates an
   *   existing folder at the path (like `mkdir -p`).
   * @param options.createMissingParents - Whether to behave like `mkdir -p`.
   * @returns The created (or, with `createMissingParents`, already existing) folder.
   */
  async createFolder(
    folderPath: string,
    options: { createMissingParents?: boolean } = {},
  ): Promise<FileSystemItem> {
    const shouldCreateMissingParents = options.createMissingParents ?? false;
    const normalizedFolderPath = normalizePath(folderPath);
    if (normalizedFolderPath === rootPath) {
      return this.getItem(rootPath);
    }

    const folderName = getBaseName(normalizedFolderPath);
    const parentFolderPath = getParentPath(normalizedFolderPath);
    const parentFolderRecord = shouldCreateMissingParents
      ? await this.createFolder(parentFolderPath, { createMissingParents: true })
      : await this.requireFolderRecord(parentFolderPath);

    const existingSibling = await this.findChildRecord(parentFolderRecord.id, folderName);
    if (existingSibling !== undefined) {
      const canReuseExistingFolder =
        shouldCreateMissingParents && existingSibling.kind === 'folder';
      if (canReuseExistingFolder) {
        return toItem(existingSibling, normalizedFolderPath);
      }
      throw new FileAlreadyExistsError(normalizedFolderPath);
    }

    return this.addRecord(normalizedFolderPath, {
      parentId: parentFolderRecord.id,
      name: folderName,
      kind: 'folder',
      mimeType: folderMimeType,
      sizeInBytes: 0,
    });
  }

  /**
   * Creates a file or replaces an existing file's content.
   * @param filePath - Absolute path of the file.
   * @param fileContent - The bytes to store.
   * @param mimeType - The content type; guessed from the name when omitted.
   * @returns The written file.
   * @throws {WrongItemKindError} When a folder or link already occupies the path.
   */
  async writeFile(
    filePath: string,
    fileContent: Uint8Array,
    mimeType?: string,
  ): Promise<FileSystemItem> {
    const normalizedFilePath = normalizePath(filePath);
    const fileName = getBaseName(normalizedFilePath);
    const parentFolderRecord = await this.requireFolderRecord(getParentPath(normalizedFilePath));
    const existingRecord = await this.findChildRecord(parentFolderRecord.id, fileName);

    if (existingRecord !== undefined) {
      if (existingRecord.kind !== 'file') {
        throw new WrongItemKindError(normalizedFilePath, 'file');
      }
      const overwrittenRecord = await this.saveRecord({
        ...existingRecord,
        content: fileContent,
        sizeInBytes: fileContent.byteLength,
        mimeType: mimeType ?? existingRecord.mimeType,
        modifiedAt: this.getCurrentTime(),
      });
      return toItem(overwrittenRecord, normalizedFilePath);
    }

    return this.addRecord(normalizedFilePath, {
      parentId: parentFolderRecord.id,
      name: fileName,
      kind: 'file',
      mimeType: mimeType ?? guessMimeTypeFromFileName(fileName),
      sizeInBytes: fileContent.byteLength,
      content: fileContent,
    });
  }

  /**
   * Reads a file's bytes.
   * @param filePath - Absolute path of the file.
   * @returns A fresh copy of the file's bytes (safe to use with `instanceof Uint8Array`).
   * @throws {WrongItemKindError} When the path is not a file.
   */
  async readFileBytes(filePath: string): Promise<Uint8Array<ArrayBuffer>> {
    const fileRecord = await this.requireRecord(filePath);
    if (fileRecord.kind !== 'file') {
      throw new WrongItemKindError(filePath, 'file');
    }
    return new Uint8Array(fileRecord.content ?? new Uint8Array());
  }

  /**
   * Creates a link to a web address or to another item (an alias).
   * @param linkPath - Absolute path of the new link.
   * @param linkTarget - Where the link points.
   * @returns The created link.
   * @throws {FileAlreadyExistsError} When something already exists at the path.
   */
  async createLink(linkPath: string, linkTarget: LinkTarget): Promise<FileSystemItem> {
    const normalizedLinkPath = normalizePath(linkPath);
    const linkName = getBaseName(normalizedLinkPath);
    const parentFolderRecord = await this.requireFolderRecord(getParentPath(normalizedLinkPath));
    if ((await this.findChildRecord(parentFolderRecord.id, linkName)) !== undefined) {
      throw new FileAlreadyExistsError(normalizedLinkPath);
    }
    return this.addRecord(normalizedLinkPath, {
      parentId: parentFolderRecord.id,
      name: linkName,
      kind: 'link',
      mimeType: linkMimeType,
      sizeInBytes: 0,
      linkTarget,
    });
  }

  /**
   * Renames an item in place.
   * @param itemPath - Absolute path of the item.
   * @param newName - The new name.
   * @returns The renamed item at its new path.
   * @throws {InvalidFileOperationError | FileAlreadyExistsError} For invalid names or name clashes.
   */
  async rename(itemPath: string, newName: string): Promise<FileSystemItem> {
    if (!isValidItemName(newName)) {
      throw new InvalidFileOperationError(`"${newName}" is not a valid name.`);
    }
    const itemRecord = await this.requireNonRootRecord(itemPath);
    const parentFolderPath = getParentPath(itemPath);
    const renamedPath = joinPath(parentFolderPath, newName);
    if (newName === itemRecord.name) {
      return toItem(itemRecord, renamedPath);
    }
    if ((await this.findChildRecord(itemRecord.parentId, newName)) !== undefined) {
      throw new FileAlreadyExistsError(renamedPath);
    }
    const renamedRecord = await this.saveRecord({
      ...itemRecord,
      name: newName,
      modifiedAt: this.getCurrentTime(),
    });
    return toItem(renamedRecord, renamedPath);
  }

  /**
   * Moves an item into another folder, keeping its name.
   * @param sourcePath - Absolute path of the item to move.
   * @param destinationFolderPath - Absolute path of the folder to move it into.
   * @returns The moved item at its new path.
   * @throws {InvalidFileOperationError | FileAlreadyExistsError} When moving a folder into itself or
   *   onto an existing name.
   */
  async move(sourcePath: string, destinationFolderPath: string): Promise<FileSystemItem> {
    const sourceRecord = await this.requireNonRootRecord(sourcePath);
    const destinationFolderRecord = await this.requireFolderRecord(destinationFolderPath);
    const movedPath = joinPath(destinationFolderPath, sourceRecord.name);
    this.assertNotMovingFolderIntoItself(sourceRecord, sourcePath, destinationFolderPath);
    if (sourceRecord.parentId === destinationFolderRecord.id) {
      return toItem(sourceRecord, movedPath);
    }
    if ((await this.findChildRecord(destinationFolderRecord.id, sourceRecord.name)) !== undefined) {
      throw new FileAlreadyExistsError(movedPath);
    }
    const movedRecord = await this.saveRecord({
      ...sourceRecord,
      parentId: destinationFolderRecord.id,
    });
    return toItem(movedRecord, movedPath);
  }

  /**
   * Copies an item (folders are copied with everything inside them). When the name is taken in the
   * destination, the copy is named like Finder does: "Notes copy.txt", "Notes copy 2.txt".
   * @param sourcePath - Absolute path of the item to copy.
   * @param destinationFolderPath - Absolute path of the folder to copy into.
   * @returns The new copy.
   * @throws {InvalidFileOperationError} When copying a folder into itself.
   */
  async copy(sourcePath: string, destinationFolderPath: string): Promise<FileSystemItem> {
    const sourceRecord = await this.requireNonRootRecord(sourcePath);
    const destinationFolderRecord = await this.requireFolderRecord(destinationFolderPath);
    this.assertNotMovingFolderIntoItself(sourceRecord, sourcePath, destinationFolderPath);

    const isNameFreeInDestination =
      (await this.findChildRecord(destinationFolderRecord.id, sourceRecord.name)) === undefined;
    const copyName = isNameFreeInDestination
      ? sourceRecord.name
      : await this.findAvailableChildName(
          destinationFolderRecord.id,
          sourceRecord.name,
          sourceRecord.kind,
          buildCopyName,
        );

    const copiedRecord = await this.runWrite(() =>
      this.database.transaction('rw', this.database.nodes, () =>
        this.copyRecordRecursively(sourceRecord, destinationFolderRecord.id, copyName),
      ),
    );
    return toItem(copiedRecord, joinPath(destinationFolderPath, copyName));
  }

  /**
   * Permanently deletes an item (and, for folders, everything inside it).
   * @param itemPath - Absolute path of the item.
   * @returns Resolves once the item is gone.
   */
  async remove(itemPath: string): Promise<void> {
    const itemRecord = await this.requireNonRootRecord(itemPath);
    await this.runWrite(() =>
      this.database.transaction('rw', this.database.nodes, async () => {
        const idsToDelete = await this.collectRecordIdsRecursively(itemRecord);
        await this.database.nodes.bulkDelete(idsToDelete);
      }),
    );
  }

  /**
   * Moves an item into the Trash, remembering where it came from for "Put Back".
   * @param itemPath - Absolute path of the item.
   * @returns The item at its new path inside the Trash.
   * @throws {InvalidFileOperationError} When trying to trash the Trash or something already in it.
   */
  async moveToTrash(itemPath: string): Promise<FileSystemItem> {
    if (isPathInsideFolder(itemPath, trashFolderPath)) {
      throw new InvalidFileOperationError('This item is already in the Trash.');
    }
    const itemRecord = await this.requireNonRootRecord(itemPath);
    const trashFolderRecord = await this.createFolder(trashFolderPath, {
      createMissingParents: true,
    });
    const trashedName = await this.findAvailableChildName(
      trashFolderRecord.id,
      itemRecord.name,
      itemRecord.kind,
      buildNumberedName,
    );
    const trashedRecord = await this.saveRecord({
      ...itemRecord,
      parentId: trashFolderRecord.id,
      name: trashedName,
      trashedFromFolderPath: getParentPath(itemPath),
      nameBeforeTrash: itemRecord.name,
    });
    return toItem(trashedRecord, joinPath(trashFolderPath, trashedName));
  }

  /**
   * Restores an item from the Trash to the folder it was deleted from (recreating that folder if
   * needed, and numbering the name if it is now taken).
   * @param trashedItemPath - Absolute path of the item inside the Trash.
   * @returns The restored item at its original location.
   * @throws {InvalidFileOperationError} When the item is not in the Trash.
   */
  async putBack(trashedItemPath: string): Promise<FileSystemItem> {
    const trashedRecord = await this.requireNonRootRecord(trashedItemPath);
    const originalFolderPath = trashedRecord.trashedFromFolderPath;
    const isDirectlyInTrash = getParentPath(trashedItemPath) === normalizePath(trashFolderPath);
    if (!isDirectlyInTrash || originalFolderPath === undefined) {
      throw new InvalidFileOperationError('Only items in the Trash can be put back.');
    }
    const originalFolderRecord = await this.createFolder(originalFolderPath, {
      createMissingParents: true,
    });
    const restoredName = await this.findAvailableChildName(
      originalFolderRecord.id,
      trashedRecord.nameBeforeTrash ?? trashedRecord.name,
      trashedRecord.kind,
      buildNumberedName,
    );
    const restoredRecord: FileSystemNodeRecord = {
      ...trashedRecord,
      parentId: originalFolderRecord.id,
      name: restoredName,
    };
    delete restoredRecord.trashedFromFolderPath;
    delete restoredRecord.nameBeforeTrash;
    await this.saveRecord(restoredRecord);
    return toItem(restoredRecord, joinPath(originalFolderPath, restoredName));
  }

  /**
   * Permanently deletes everything in the Trash.
   * @returns Resolves once the Trash is empty.
   */
  async emptyTrash(): Promise<void> {
    if (!(await this.exists(trashFolderPath))) {
      return;
    }
    for (const trashedItem of await this.listFolder(trashFolderPath)) {
      await this.remove(trashedItem.path);
    }
  }

  /**
   * Records which seeded content a file was created from, so later seed upgrades can tell whether the
   * visitor has changed it.
   * @param filePath - Absolute path of the seeded file.
   * @param seedFingerprint - Fingerprint of the seeded content.
   * @returns The updated file.
   */
  async setSeedFingerprint(filePath: string, seedFingerprint: string): Promise<FileSystemItem> {
    const fileRecord = await this.requireNonRootRecord(filePath);
    return toItem(await this.saveRecord({ ...fileRecord, seedFingerprint }), filePath);
  }

  /**
   * Picks a name that is free inside a folder, numbering it if needed ("untitled folder 2").
   * @param folderPath - Absolute path of the folder.
   * @param desiredName - The name to start from.
   * @param itemKind - The kind of item being named (files keep their extension last).
   * @returns A name that no sibling currently uses.
   */
  async createUniqueChildName(
    folderPath: string,
    desiredName: string,
    itemKind: FileSystemItemKind,
  ): Promise<string> {
    const folderRecord = await this.requireFolderRecord(folderPath);
    return this.findAvailableChildName(folderRecord.id, desiredName, itemKind, buildNumberedName);
  }

  /**
   * Walks the path one name at a time from the root.
   * @param itemPath - Absolute path to resolve.
   * @returns The record at that path, or undefined.
   */
  private async findRecordByPath(itemPath: string): Promise<FileSystemNodeRecord | undefined> {
    let currentRecord = await this.database.nodes.get(rootFolderId);
    for (const pathName of splitPathIntoNames(itemPath)) {
      if (currentRecord?.kind !== 'folder') {
        return undefined;
      }
      currentRecord = await this.findChildRecord(currentRecord.id, pathName);
    }
    return currentRecord;
  }

  /**
   * Finds a direct child of a folder by name using the unique [parentId+name] index.
   * @param parentFolderId - Id of the folder to look in.
   * @param childName - Name of the child.
   * @returns The child record, or undefined.
   */
  private findChildRecord(
    parentFolderId: string,
    childName: string,
  ): Promise<FileSystemNodeRecord | undefined> {
    return this.database.nodes.where('[parentId+name]').equals([parentFolderId, childName]).first();
  }

  /**
   * Resolves a path and throws when nothing is there.
   * @param itemPath - Absolute path to resolve.
   * @returns The record at that path.
   * @throws {FileNotFoundError} When the path does not exist.
   */
  private async requireRecord(itemPath: string): Promise<FileSystemNodeRecord> {
    const foundRecord = await this.findRecordByPath(itemPath);
    if (foundRecord === undefined) {
      throw new FileNotFoundError(normalizePath(itemPath));
    }
    return foundRecord;
  }

  /**
   * Resolves a path that must be an existing folder.
   * @param folderPath - Absolute path of the folder.
   * @returns The folder record.
   * @throws {FileNotFoundError | WrongItemKindError} When missing or not a folder.
   */
  private async requireFolderRecord(folderPath: string): Promise<FileSystemItem> {
    const folderRecord = await this.requireRecord(folderPath);
    if (folderRecord.kind !== 'folder') {
      throw new WrongItemKindError(normalizePath(folderPath), 'folder');
    }
    return toItem(folderRecord, folderPath);
  }

  /**
   * Resolves a path that must exist and must not be the root folder.
   * @param itemPath - Absolute path of the item.
   * @returns The item's record.
   * @throws {InvalidFileOperationError} When the path is the root folder.
   */
  private async requireNonRootRecord(itemPath: string): Promise<FileSystemNodeRecord> {
    const itemRecord = await this.requireRecord(itemPath);
    if (itemRecord.id === rootFolderId) {
      throw new InvalidFileOperationError('The root folder cannot be changed.');
    }
    return itemRecord;
  }

  /**
   * Rejects moving or copying a folder into itself or one of its own subfolders.
   * @param sourceRecord - The item being moved or copied.
   * @param sourcePath - Its absolute path.
   * @param destinationFolderPath - The folder it would go into.
   * @throws {InvalidFileOperationError} When the destination is inside the source folder.
   */
  private assertNotMovingFolderIntoItself(
    sourceRecord: FileSystemNodeRecord,
    sourcePath: string,
    destinationFolderPath: string,
  ): void {
    const isDestinationInsideSource =
      sourceRecord.kind === 'folder' && isPathInsideFolder(destinationFolderPath, sourcePath);
    if (isDestinationInsideSource) {
      throw new InvalidFileOperationError('A folder cannot be moved or copied into itself.');
    }
  }

  /**
   * Tries candidate names until one is free in the folder.
   * @param parentFolderId - Id of the folder.
   * @param desiredName - Name to base candidates on.
   * @param itemKind - Kind of the item being named.
   * @param buildCandidateName - Produces the candidate for each attempt number.
   * @returns The first free candidate name.
   */
  private async findAvailableChildName(
    parentFolderId: string,
    desiredName: string,
    itemKind: FileSystemItemKind,
    buildCandidateName: (name: string, attempt: number, kind: FileSystemItemKind) => string,
  ): Promise<string> {
    for (let attemptNumber = 1; ; attemptNumber += 1) {
      const candidateName = buildCandidateName(desiredName, attemptNumber, itemKind);
      if ((await this.findChildRecord(parentFolderId, candidateName)) === undefined) {
        return candidateName;
      }
    }
  }

  /**
   * Stores a new record with fresh id and timestamps.
   * @param itemPath - The new item's absolute path (used for the returned item).
   * @param recordFields - Everything except id and timestamps.
   * @returns The stored item.
   */
  private async addRecord(
    itemPath: string,
    recordFields: Omit<FileSystemNodeRecord, 'id' | 'createdAt' | 'modifiedAt'>,
  ): Promise<FileSystemItem> {
    const creationTime = this.getCurrentTime();
    const newRecord: FileSystemNodeRecord = {
      ...recordFields,
      id: this.createItemId(),
      createdAt: creationTime,
      modifiedAt: creationTime,
    };
    await this.runWrite(() => this.database.nodes.add(newRecord));
    return toItem(newRecord, itemPath);
  }

  /**
   * Copies a record and, for folders, all descendants. Must run inside a transaction.
   * @param sourceRecord - The record to copy.
   * @param destinationParentId - Id of the folder receiving the copy.
   * @param copyName - Name for the copy.
   * @returns The new top-level record.
   */
  private async copyRecordRecursively(
    sourceRecord: FileSystemNodeRecord,
    destinationParentId: string,
    copyName: string,
  ): Promise<FileSystemNodeRecord> {
    const copyTime = this.getCurrentTime();
    const copiedRecord: FileSystemNodeRecord = {
      ...sourceRecord,
      id: this.createItemId(),
      parentId: destinationParentId,
      name: copyName,
      createdAt: copyTime,
      modifiedAt: copyTime,
    };
    // A copy is the visitor's own item: it is not seeded content and is not in the Trash.
    delete copiedRecord.seedFingerprint;
    delete copiedRecord.trashedFromFolderPath;
    delete copiedRecord.nameBeforeTrash;
    await this.database.nodes.add(withLocalContentCopy(copiedRecord));
    if (sourceRecord.kind === 'folder') {
      const childRecords = await this.database.nodes
        .where('parentId')
        .equals(sourceRecord.id)
        .toArray();
      for (const childRecord of childRecords) {
        await this.copyRecordRecursively(childRecord, copiedRecord.id, childRecord.name);
      }
    }
    return copiedRecord;
  }

  /**
   * Collects a record's id and the ids of everything nested inside it.
   * @param topRecord - The record to start from.
   * @returns All ids in the subtree.
   */
  private async collectRecordIdsRecursively(topRecord: FileSystemNodeRecord): Promise<string[]> {
    const collectedIds = [topRecord.id];
    if (topRecord.kind === 'folder') {
      const childRecords = await this.database.nodes
        .where('parentId')
        .equals(topRecord.id)
        .toArray();
      for (const childRecord of childRecords) {
        collectedIds.push(...(await this.collectRecordIdsRecursively(childRecord)));
      }
    }
    return collectedIds;
  }

  /**
   * Stores a complete record, replacing the previous version. Used instead of Dexie's update(), whose
   * deep-clone can drop file bytes that came from another JavaScript realm (found in the Phase 1 tests).
   * @param recordToSave - The full record to store.
   * @returns The record as stored.
   */
  private async saveRecord(recordToSave: FileSystemNodeRecord): Promise<FileSystemNodeRecord> {
    const recordWithLocalContent = withLocalContentCopy(recordToSave);
    await this.runWrite(() => this.database.nodes.put(recordWithLocalContent));
    return recordWithLocalContent;
  }

  /**
   * Runs a database write, turning "storage full" failures into a friendly error.
   * @param writeOperation - The write to run.
   * @returns Whatever the write resolves to.
   * @throws {StorageQuotaExceededError} When the browser's storage quota is full.
   */
  private async runWrite<WriteResult>(
    writeOperation: () => Promise<WriteResult>,
  ): Promise<WriteResult> {
    try {
      return await writeOperation();
    } catch (writeError) {
      if (isQuotaExceededError(writeError)) {
        throw new StorageQuotaExceededError(writeError);
      }
      throw writeError;
    }
  }
}

/**
 * Attaches a normalized path to a stored record.
 * @param nodeRecord - The stored record.
 * @param itemPath - The record's absolute path.
 * @returns The record as a filesystem item.
 */
function toItem(nodeRecord: FileSystemNodeRecord, itemPath: string): FileSystemItem {
  return { ...nodeRecord, path: normalizePath(itemPath) };
}

/**
 * Returns the record with its file content copied into a fresh `Uint8Array` from this JavaScript
 * realm, so storing it never depends on where the original bytes came from.
 * @param nodeRecord - The record to prepare for storage.
 * @returns The same record (when it has no content) or a copy with re-wrapped content.
 */
function withLocalContentCopy(nodeRecord: FileSystemNodeRecord): FileSystemNodeRecord {
  if (nodeRecord.content === undefined) {
    return nodeRecord;
  }
  return { ...nodeRecord, content: new Uint8Array(nodeRecord.content) };
}
