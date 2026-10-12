import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DesktopDatabase } from '../storage/desktop-database.mts';
import {
  FileAlreadyExistsError,
  FileNotFoundError,
  InvalidFileOperationError,
  StorageQuotaExceededError,
  WrongItemKindError,
} from './file-system-errors.mts';
import {
  VirtualFileSystem,
  buildCopyName,
  buildNumberedName,
  createRandomItemId,
} from './virtual-file-system.mts';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let testDatabase: DesktopDatabase;
let fileSystem: VirtualFileSystem;
let fakeClockTime: number;
let nextFakeId: number;

/**
 * Reads the test's controllable clock.
 * @returns The fake current time in milliseconds.
 */
function readFakeClock(): number {
  return fakeClockTime;
}

/**
 * Produces predictable ids ("id-1", "id-2", ...).
 * @returns The next fake id.
 */
function createSequentialFakeId(): string {
  return `id-${String(nextFakeId++)}`;
}

beforeEach(async () => {
  testDatabase = new DesktopDatabase(`vfs-test-${String(Math.random())}`);
  fakeClockTime = 1_000;
  nextFakeId = 1;
  fileSystem = new VirtualFileSystem(testDatabase, {
    getCurrentTime: readFakeClock,
    createItemId: createSequentialFakeId,
  });
  await fileSystem.ensureRootFolder();
  await fileSystem.createFolder('/Users/guest/Desktop', { createMissingParents: true });
});

afterEach(async () => {
  await testDatabase.delete();
});

describe('name helpers', () => {
  it('number names macOS-style, keeping file extensions last', () => {
    expect(buildNumberedName('untitled folder', 1, 'folder')).toBe('untitled folder');
    expect(buildNumberedName('untitled folder', 2, 'folder')).toBe('untitled folder 2');
    expect(buildNumberedName('Notes.txt', 3, 'file')).toBe('Notes 3.txt');
  });

  it('name copies macOS-style', () => {
    expect(buildCopyName('Notes.txt', 1, 'file')).toBe('Notes copy.txt');
    expect(buildCopyName('Notes.txt', 2, 'file')).toBe('Notes copy 2.txt');
    expect(buildCopyName('Projects', 1, 'folder')).toBe('Projects copy');
  });

  it('creates distinct random ids', () => {
    expect(createRandomItemId()).not.toBe(createRandomItemId());
    expect(createRandomItemId()).toMatch(/^[a-z0-9]+-[0-9a-f]{16}$/);
  });
});

describe('VirtualFileSystem lookups', () => {
  it('ensureRootFolder is idempotent', async () => {
    await fileSystem.ensureRootFolder();
    expect((await fileSystem.getItem('/')).kind).toBe('folder');
  });

  it('finds items by path and reports missing ones', async () => {
    expect((await fileSystem.getItem('/Users/guest/Desktop')).path).toBe('/Users/guest/Desktop');
    expect(await fileSystem.findItem('/Users/nobody')).toBeUndefined();
    expect(await fileSystem.exists('/Users/guest')).toBe(true);
    await expect(fileSystem.getItem('/missing')).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it('does not walk through files when resolving deeper paths', async () => {
    await fileSystem.writeFile('/Users/guest/a.txt', textEncoder.encode('a'));
    expect(await fileSystem.findItem('/Users/guest/a.txt/inside')).toBeUndefined();
  });

  it('lists folders in Finder order and rejects listing a file', async () => {
    for (const childName of ['b', 'A', 'item 10', 'item 2']) {
      await fileSystem.createFolder(`/Users/guest/Desktop/${childName}`);
    }
    const listedNames = (await fileSystem.listFolder('/Users/guest/Desktop')).map(
      (item) => item.name,
    );
    expect(listedNames).toEqual(['A', 'b', 'item 2', 'item 10']);

    await fileSystem.writeFile('/Users/guest/a.txt', textEncoder.encode('a'));
    await expect(fileSystem.listFolder('/Users/guest/a.txt')).rejects.toBeInstanceOf(
      WrongItemKindError,
    );
  });

  it('lists every item with its path but without file contents', async () => {
    await fileSystem.writeFile('/Users/guest/Desktop/Note.txt', textEncoder.encode('hello'));
    await fileSystem.createFolder('/Users/guest/Projects/Deep/Deeper', {
      createMissingParents: true,
    });

    const allItems = await fileSystem.listAllItems();

    expect(allItems.map((item) => item.path).sort()).toEqual([
      '/Users',
      '/Users/guest',
      '/Users/guest/Desktop',
      '/Users/guest/Desktop/Note.txt',
      '/Users/guest/Projects',
      '/Users/guest/Projects/Deep',
      '/Users/guest/Projects/Deep/Deeper',
    ]);
    const noteItem = allItems.find((item) => item.name === 'Note.txt');
    expect(noteItem).toMatchObject({ kind: 'file', sizeInBytes: 5 });
    expect(noteItem?.content).toBeUndefined();
  });

  it('leaves out items whose parent folder is missing or that form a parent loop', async () => {
    await testDatabase.nodes.bulkAdd([
      { ...orphanRecordFields, id: 'orphan', parentId: 'no-such-folder', name: 'Orphan' },
      { ...orphanRecordFields, id: 'loop-a', parentId: 'loop-b', name: 'Loop A' },
      { ...orphanRecordFields, id: 'loop-b', parentId: 'loop-a', name: 'Loop B' },
    ]);

    const listedNames = (await fileSystem.listAllItems()).map((item) => item.name);

    expect(listedNames).not.toContain('Orphan');
    expect(listedNames).not.toContain('Loop A');
    expect(listedNames).toContain('Desktop');
  });
});

/** Fields shared by the broken records stored directly in the database by the test above. */
const orphanRecordFields = {
  kind: 'folder' as const,
  mimeType: 'inode/directory',
  sizeInBytes: 0,
  createdAt: 0,
  modifiedAt: 0,
};

describe('VirtualFileSystem creating items', () => {
  it('creates folders and refuses duplicates or missing parents', async () => {
    const createdFolder = await fileSystem.createFolder('/Users/guest/Desktop/New');
    expect(createdFolder).toMatchObject({ name: 'New', kind: 'folder', createdAt: 1_000 });

    await expect(fileSystem.createFolder('/Users/guest/Desktop/New')).rejects.toBeInstanceOf(
      FileAlreadyExistsError,
    );
    await expect(fileSystem.createFolder('/nope/child')).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it('createFolder with createMissingParents behaves like mkdir -p', async () => {
    await fileSystem.createFolder('/a/b/c', { createMissingParents: true });
    expect((await fileSystem.getItem('/a/b/c')).kind).toBe('folder');
    expect((await fileSystem.createFolder('/a/b', { createMissingParents: true })).path).toBe(
      '/a/b',
    );
    expect((await fileSystem.createFolder('/', { createMissingParents: true })).path).toBe('/');

    await fileSystem.writeFile('/a/file.txt', textEncoder.encode('x'));
    await expect(
      fileSystem.createFolder('/a/file.txt', { createMissingParents: true }),
    ).rejects.toBeInstanceOf(FileAlreadyExistsError);
  });

  it('writes, reads and overwrites files', async () => {
    const writtenFile = await fileSystem.writeFile(
      '/Users/guest/Notes.txt',
      textEncoder.encode('hi'),
    );
    expect(writtenFile).toMatchObject({ kind: 'file', mimeType: 'text/plain', sizeInBytes: 2 });

    fakeClockTime = 2_000;
    const overwrittenFile = await fileSystem.writeFile(
      '/Users/guest/Notes.txt',
      textEncoder.encode('hello'),
    );
    expect(overwrittenFile).toMatchObject({ sizeInBytes: 5, modifiedAt: 2_000, createdAt: 1_000 });
    const readBytes = await fileSystem.readFileBytes('/Users/guest/Notes.txt');
    expect(readBytes).toBeInstanceOf(Uint8Array);
    expect(textDecoder.decode(readBytes)).toBe('hello');
  });

  it('keeps or replaces the MIME type when overwriting', async () => {
    await fileSystem.writeFile('/Users/guest/data', textEncoder.encode('x'), 'application/json');
    expect(
      (await fileSystem.writeFile('/Users/guest/data', textEncoder.encode('y'))).mimeType,
    ).toBe('application/json');
    expect(
      (await fileSystem.writeFile('/Users/guest/data', textEncoder.encode('z'), 'text/csv'))
        .mimeType,
    ).toBe('text/csv');
  });

  it('refuses to write a file over a folder and to read a folder as a file', async () => {
    await expect(
      fileSystem.writeFile('/Users/guest/Desktop', textEncoder.encode('x')),
    ).rejects.toBeInstanceOf(WrongItemKindError);
    await expect(fileSystem.readFileBytes('/Users/guest/Desktop')).rejects.toBeInstanceOf(
      WrongItemKindError,
    );
  });

  it('reads an empty file whose content was never stored', async () => {
    await testDatabase.nodes.add({
      id: 'contentless',
      parentId: (await fileSystem.getItem('/Users/guest')).id,
      name: 'empty.txt',
      kind: 'file',
      mimeType: 'text/plain',
      sizeInBytes: 0,
      createdAt: 0,
      modifiedAt: 0,
    });
    expect(await fileSystem.readFileBytes('/Users/guest/empty.txt')).toEqual(new Uint8Array());
  });

  it('creates web links and aliases, refusing name clashes', async () => {
    const webLink = await fileSystem.createLink('/Users/guest/Desktop/GitHub', {
      kind: 'url',
      url: 'https://github.com/',
    });
    expect(webLink).toMatchObject({ kind: 'link', linkTarget: { kind: 'url' } });
    await expect(
      fileSystem.createLink('/Users/guest/Desktop/GitHub', { kind: 'path', path: '/' }),
    ).rejects.toBeInstanceOf(FileAlreadyExistsError);
  });

  it('suggests unique child names', async () => {
    expect(
      await fileSystem.createUniqueChildName('/Users/guest/Desktop', 'untitled folder', 'folder'),
    ).toBe('untitled folder');
    await fileSystem.createFolder('/Users/guest/Desktop/untitled folder');
    await fileSystem.createFolder('/Users/guest/Desktop/untitled folder 2');
    expect(
      await fileSystem.createUniqueChildName('/Users/guest/Desktop', 'untitled folder', 'folder'),
    ).toBe('untitled folder 3');
  });
});

describe('VirtualFileSystem renaming, moving and copying', () => {
  it('renames items and validates the new name', async () => {
    await fileSystem.createFolder('/Users/guest/Desktop/Old');
    fakeClockTime = 5_000;
    const renamedFolder = await fileSystem.rename('/Users/guest/Desktop/Old', 'New');
    expect(renamedFolder).toMatchObject({ path: '/Users/guest/Desktop/New', modifiedAt: 5_000 });
    expect(await fileSystem.exists('/Users/guest/Desktop/Old')).toBe(false);

    expect((await fileSystem.rename('/Users/guest/Desktop/New', 'New')).name).toBe('New');
    await fileSystem.createFolder('/Users/guest/Desktop/Other');
    await expect(fileSystem.rename('/Users/guest/Desktop/New', 'Other')).rejects.toBeInstanceOf(
      FileAlreadyExistsError,
    );
    await expect(fileSystem.rename('/Users/guest/Desktop/New', 'a/b')).rejects.toBeInstanceOf(
      InvalidFileOperationError,
    );
    await expect(fileSystem.rename('/', 'root')).rejects.toBeInstanceOf(InvalidFileOperationError);
  });

  it('moves items between folders', async () => {
    await fileSystem.createFolder('/Users/guest/Documents');
    await fileSystem.writeFile('/Users/guest/Desktop/a.txt', textEncoder.encode('a'));

    const movedFile = await fileSystem.move('/Users/guest/Desktop/a.txt', '/Users/guest/Documents');

    expect(movedFile.path).toBe('/Users/guest/Documents/a.txt');
    expect(await fileSystem.exists('/Users/guest/Desktop/a.txt')).toBe(false);
    expect(
      (await fileSystem.move('/Users/guest/Documents/a.txt', '/Users/guest/Documents')).path,
    ).toBe('/Users/guest/Documents/a.txt');
  });

  it('refuses moves into itself or onto an existing name', async () => {
    await fileSystem.createFolder('/Users/guest/Desktop/Parent/Child', {
      createMissingParents: true,
    });
    await expect(
      fileSystem.move('/Users/guest/Desktop/Parent', '/Users/guest/Desktop/Parent/Child'),
    ).rejects.toBeInstanceOf(InvalidFileOperationError);

    await fileSystem.createFolder('/Users/guest/Child');
    await expect(
      fileSystem.move('/Users/guest/Child', '/Users/guest/Desktop/Parent'),
    ).rejects.toBeInstanceOf(FileAlreadyExistsError);
  });

  it('copies folders deeply and names copies like Finder', async () => {
    await fileSystem.createFolder('/Users/guest/Desktop/Project/src', {
      createMissingParents: true,
    });
    await fileSystem.writeFile(
      '/Users/guest/Desktop/Project/src/main.txt',
      textEncoder.encode('m'),
    );
    await fileSystem.createFolder('/Users/guest/Documents');

    const copiedFolder = await fileSystem.copy(
      '/Users/guest/Desktop/Project',
      '/Users/guest/Documents',
    );
    expect(copiedFolder.path).toBe('/Users/guest/Documents/Project');
    expect(
      textDecoder.decode(
        await fileSystem.readFileBytes('/Users/guest/Documents/Project/src/main.txt'),
      ),
    ).toBe('m');

    const duplicateInPlace = await fileSystem.copy(
      '/Users/guest/Desktop/Project',
      '/Users/guest/Desktop',
    );
    expect(duplicateInPlace.name).toBe('Project copy');
    const secondDuplicate = await fileSystem.copy(
      '/Users/guest/Desktop/Project',
      '/Users/guest/Desktop',
    );
    expect(secondDuplicate.name).toBe('Project copy 2');
  });

  it('drops seed and trash bookkeeping on copies and refuses copying a folder into itself', async () => {
    await fileSystem.writeFile('/Users/guest/Desktop/seeded.txt', textEncoder.encode('s'));
    const seededRecord = await fileSystem.getItem('/Users/guest/Desktop/seeded.txt');
    await testDatabase.nodes.update(seededRecord.id, { seedFingerprint: 'abc' });

    const copiedFile = await fileSystem.copy('/Users/guest/Desktop/seeded.txt', '/Users/guest');
    expect(copiedFile.seedFingerprint).toBeUndefined();

    await expect(
      fileSystem.copy('/Users/guest/Desktop', '/Users/guest/Desktop'),
    ).rejects.toBeInstanceOf(InvalidFileOperationError);
  });

  it('removes items and their contents permanently', async () => {
    await fileSystem.createFolder('/Users/guest/Desktop/Gone/inner', {
      createMissingParents: true,
    });
    await fileSystem.writeFile('/Users/guest/Desktop/Gone/inner/x.txt', textEncoder.encode('x'));
    const recordCountBefore = await testDatabase.nodes.count();

    await fileSystem.remove('/Users/guest/Desktop/Gone');

    expect(await fileSystem.exists('/Users/guest/Desktop/Gone')).toBe(false);
    expect(await testDatabase.nodes.count()).toBe(recordCountBefore - 3);
    await expect(fileSystem.remove('/')).rejects.toBeInstanceOf(InvalidFileOperationError);
  });
});

describe('VirtualFileSystem Trash', () => {
  it('moves items to the Trash, numbering clashes, and puts them back', async () => {
    await fileSystem.writeFile('/Users/guest/Desktop/Notes.txt', textEncoder.encode('1'));
    const firstTrashedItem = await fileSystem.moveToTrash('/Users/guest/Desktop/Notes.txt');
    expect(firstTrashedItem.path).toBe('/Users/guest/.Trash/Notes.txt');

    await fileSystem.writeFile('/Users/guest/Desktop/Notes.txt', textEncoder.encode('2'));
    const secondTrashedItem = await fileSystem.moveToTrash('/Users/guest/Desktop/Notes.txt');
    expect(secondTrashedItem.path).toBe('/Users/guest/.Trash/Notes 2.txt');

    const restoredItem = await fileSystem.putBack('/Users/guest/.Trash/Notes 2.txt');
    expect(restoredItem.path).toBe('/Users/guest/Desktop/Notes.txt');
    expect(restoredItem.trashedFromFolderPath).toBeUndefined();
    expect(
      textDecoder.decode(await fileSystem.readFileBytes('/Users/guest/Desktop/Notes.txt')),
    ).toBe('2');

    const restoredClash = await fileSystem.putBack('/Users/guest/.Trash/Notes.txt');
    expect(restoredClash.path).toBe('/Users/guest/Desktop/Notes 2.txt');
  });

  it('recreates the original folder when putting back', async () => {
    await fileSystem.createFolder('/Users/guest/Desktop/Temp');
    await fileSystem.writeFile('/Users/guest/Desktop/Temp/a.txt', textEncoder.encode('a'));
    await fileSystem.moveToTrash('/Users/guest/Desktop/Temp/a.txt');
    await fileSystem.remove('/Users/guest/Desktop/Temp');

    const restoredItem = await fileSystem.putBack('/Users/guest/.Trash/a.txt');

    expect(restoredItem.path).toBe('/Users/guest/Desktop/Temp/a.txt');
  });

  it('refuses to trash items already in the Trash or put back items that are not trashed', async () => {
    await fileSystem.writeFile('/Users/guest/Desktop/a.txt', textEncoder.encode('a'));
    await fileSystem.moveToTrash('/Users/guest/Desktop/a.txt');
    await expect(fileSystem.moveToTrash('/Users/guest/.Trash/a.txt')).rejects.toBeInstanceOf(
      InvalidFileOperationError,
    );
    await expect(fileSystem.putBack('/Users/guest/Desktop')).rejects.toBeInstanceOf(
      InvalidFileOperationError,
    );
  });

  it('empties the Trash, and emptying a missing Trash is harmless', async () => {
    await fileSystem.emptyTrash();
    await fileSystem.writeFile('/Users/guest/Desktop/a.txt', textEncoder.encode('a'));
    await fileSystem.moveToTrash('/Users/guest/Desktop/a.txt');

    await fileSystem.emptyTrash();

    expect(await fileSystem.listFolder('/Users/guest/.Trash')).toEqual([]);
  });
});

describe('VirtualFileSystem keeps file content', () => {
  // Regression (Phase 1): Dexie's update() lost bytes that came from another JavaScript realm.
  it('through rename, move, Trash and Put Back', async () => {
    await fileSystem.createFolder('/Users/guest/Documents');
    await fileSystem.writeFile('/Users/guest/Desktop/keep.txt', textEncoder.encode('precious'));

    await fileSystem.rename('/Users/guest/Desktop/keep.txt', 'kept.txt');
    await fileSystem.move('/Users/guest/Desktop/kept.txt', '/Users/guest/Documents');
    await fileSystem.moveToTrash('/Users/guest/Documents/kept.txt');
    await fileSystem.putBack('/Users/guest/.Trash/kept.txt');
    await fileSystem.copy('/Users/guest/Documents/kept.txt', '/Users/guest/Desktop');

    for (const finalPath of ['/Users/guest/Documents/kept.txt', '/Users/guest/Desktop/kept.txt']) {
      expect(textDecoder.decode(await fileSystem.readFileBytes(finalPath))).toBe('precious');
    }
  });
});

describe('VirtualFileSystem storage errors', () => {
  it('reports a full storage quota with a friendly error', async () => {
    const quotaError = new Error('quota');
    quotaError.name = 'QuotaExceededError';
    testDatabase.nodes.hook('creating', () => {
      throw quotaError;
    });

    await expect(
      fileSystem.writeFile('/Users/guest/big.bin', new Uint8Array(10)),
    ).rejects.toBeInstanceOf(StorageQuotaExceededError);
  });

  it('passes other write errors through unchanged', async () => {
    const unexpectedError = new Error('disk on fire');
    testDatabase.nodes.hook('creating', () => {
      throw unexpectedError;
    });

    await expect(fileSystem.createFolder('/Users/guest/x')).rejects.toThrow('disk on fire');
  });
});
