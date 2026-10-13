import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileSystemItem } from '../fs/file-system.types.mts';
import { VirtualFileSystem } from '../fs/virtual-file-system.mts';
import { DesktopDatabase } from '../storage/desktop-database.mts';
import {
  createUntitledFolder,
  decideFileDropOperation,
  downloadFileToComputer,
  openUrlInNewBrowserTab,
  performFileDrop,
  planItemOpening,
  renameItemFromField,
  resolveItemOpeningPlan,
  untitledFolderName,
} from './item-actions.mts';

/**
 * Builds a filesystem item with sensible defaults.
 * @param overrides - Fields to change.
 * @returns The item.
 */
function buildItem(overrides: Partial<FileSystemItem>): FileSystemItem {
  return {
    id: 'x',
    parentId: 'p',
    name: 'x',
    path: '/x',
    kind: 'file',
    mimeType: 'text/plain',
    sizeInBytes: 0,
    createdAt: 0,
    modifiedAt: 0,
    ...overrides,
  };
}

const textEncoder = new TextEncoder();
let testDatabase: DesktopDatabase;
let fileSystem: VirtualFileSystem;

beforeEach(async () => {
  testDatabase = new DesktopDatabase(`item-actions-test-${String(Math.random())}`);
  fileSystem = new VirtualFileSystem(testDatabase);
  await fileSystem.ensureRootFolder();
  await fileSystem.createFolder('/Users/guest/Desktop', { createMissingParents: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await testDatabase.delete();
});

describe('createUntitledFolder', () => {
  it('names new folders like macOS, numbering repeats', async () => {
    const firstFolder = await createUntitledFolder(fileSystem, '/Users/guest/Desktop');
    const secondFolder = await createUntitledFolder(fileSystem, '/Users/guest/Desktop');

    expect(firstFolder.name).toBe(untitledFolderName);
    expect(secondFolder.name).toBe('untitled folder 2');
    expect(secondFolder.kind).toBe('folder');
  });
});

describe('openUrlInNewBrowserTab', () => {
  it('opens links without giving the new page access to the desktop', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    openUrlInNewBrowserTab('https://example.com/');

    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://example.com/',
      '_blank',
      'noopener,noreferrer',
    );
  });
});

describe('planItemOpening', () => {
  const folder = buildItem({ kind: 'folder', path: '/Users/guest/Projects' });
  const textFile = buildItem({ path: '/Users/guest/Desktop/Notes.txt' });
  const webLink = buildItem({
    kind: 'link',
    linkTarget: { kind: 'url', url: 'https://example.com/' },
  });
  const folderAlias = buildItem({
    kind: 'link',
    name: 'Projects',
    linkTarget: { kind: 'path', path: '/Users/guest/Projects' },
  });

  it('shows folders in Finder, previews files, and opens web links in a new tab', () => {
    expect(planItemOpening(folder, undefined)).toEqual({
      kind: 'show-folder',
      folderPath: '/Users/guest/Projects',
    });
    expect(planItemOpening(textFile, undefined)).toEqual({
      kind: 'preview-file',
      filePath: '/Users/guest/Desktop/Notes.txt',
    });
    expect(planItemOpening(webLink, undefined)).toEqual({
      kind: 'open-url',
      url: 'https://example.com/',
    });
  });

  it('opens an alias’s original, and reports an alias whose original is gone', () => {
    expect(planItemOpening(folderAlias, folder)).toEqual({
      kind: 'show-folder',
      folderPath: '/Users/guest/Projects',
    });
    expect(planItemOpening(folderAlias, undefined)).toEqual({
      kind: 'missing-original',
      aliasName: 'Projects',
    });
    expect(planItemOpening(folderAlias, folderAlias)).toEqual({
      kind: 'missing-original',
      aliasName: 'Projects',
    });
  });

  it('looks up an alias’s original in the filesystem', async () => {
    await fileSystem.createFolder('/Users/guest/Projects');

    expect(await resolveItemOpeningPlan(fileSystem, folderAlias)).toEqual({
      kind: 'show-folder',
      folderPath: '/Users/guest/Projects',
    });
    expect(await resolveItemOpeningPlan(fileSystem, textFile)).toEqual({
      kind: 'preview-file',
      filePath: '/Users/guest/Desktop/Notes.txt',
    });
  });
});

describe('downloadFileToComputer', () => {
  it('hands the file to the browser as a download with its own name, then frees the address', async () => {
    // Only setTimeout is faked: the in-memory database schedules its work with setImmediate.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await fileSystem.writeFile('/Users/guest/Desktop/Notes.txt', textEncoder.encode('hello'));
    const createObjectUrl = vi.fn((downloadBlob: Blob) => `blob:${String(downloadBlob.size)}`);
    const revokeObjectUrl = vi.fn();
    Object.assign(URL, { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl });
    const clickedLinks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function recordClick(
      this: HTMLAnchorElement,
    ) {
      clickedLinks.push(this);
    });

    await downloadFileToComputer(fileSystem, '/Users/guest/Desktop/Notes.txt');

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(clickedLinks[0]?.download).toBe('Notes.txt');
    expect(clickedLinks[0]?.getAttribute('href')).toBe('blob:5');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:5');
  });

  it('refuses to download a folder', async () => {
    await expect(downloadFileToComputer(fileSystem, '/Users/guest/Desktop')).rejects.toBeInstanceOf(
      Error,
    );
  });
});

describe('decideFileDropOperation', () => {
  const noteOnDesktop = buildItem({ path: '/Users/guest/Desktop/Notes.txt' });
  const projectsFolder = buildItem({ kind: 'folder', path: '/Users/guest/Projects' });
  const trashedNote = buildItem({ path: '/Users/guest/.Trash/Notes.txt' });

  it('moves items into other folders', () => {
    expect(
      decideFileDropOperation(noteOnDesktop, {
        kind: 'folder',
        folderPath: '/Users/guest/Projects',
      }),
    ).toBe('move');
    expect(
      decideFileDropOperation(trashedNote, { kind: 'folder', folderPath: '/Users/guest/Desktop' }),
    ).toBe('move');
  });

  it('sends items dropped on the Trash (or into an open Trash window) to the Trash', () => {
    expect(decideFileDropOperation(noteOnDesktop, { kind: 'trash' })).toBe('move-to-trash');
    expect(
      decideFileDropOperation(noteOnDesktop, { kind: 'folder', folderPath: '/Users/guest/.Trash' }),
    ).toBe('move-to-trash');
    expect(decideFileDropOperation(trashedNote, { kind: 'trash' })).toBe('none');
  });

  it('does nothing when dropped where it already is, or when a folder is dropped into itself', () => {
    expect(
      decideFileDropOperation(noteOnDesktop, {
        kind: 'folder',
        folderPath: '/Users/guest/Desktop/',
      }),
    ).toBe('none');
    expect(
      decideFileDropOperation(projectsFolder, {
        kind: 'folder',
        folderPath: '/Users/guest/Projects',
      }),
    ).toBe('none');
    expect(
      decideFileDropOperation(projectsFolder, {
        kind: 'folder',
        folderPath: '/Users/guest/Projects/Inner',
      }),
    ).toBe('none');
  });
});

describe('performFileDrop', () => {
  it('moves, trashes, or leaves items as decided', async () => {
    await fileSystem.createFolder('/Users/guest/Projects');
    const note = await fileSystem.writeFile(
      '/Users/guest/Desktop/Notes.txt',
      textEncoder.encode('n'),
    );

    expect(
      await performFileDrop(fileSystem, note, {
        kind: 'folder',
        folderPath: '/Users/guest/Desktop',
      }),
    ).toBe('none');
    expect(
      await performFileDrop(fileSystem, note, {
        kind: 'folder',
        folderPath: '/Users/guest/Projects',
      }),
    ).toBe('move');
    expect(await fileSystem.exists('/Users/guest/Projects/Notes.txt')).toBe(true);

    const movedNote = await fileSystem.getItem('/Users/guest/Projects/Notes.txt');
    expect(await performFileDrop(fileSystem, movedNote, { kind: 'trash' })).toBe('move-to-trash');
    expect(await fileSystem.exists('/Users/guest/.Trash/Notes.txt')).toBe(true);
  });
});

describe('renameItemFromField', () => {
  it('renames to the trimmed name, and keeps the name when the field is empty or unchanged', async () => {
    const folder = await fileSystem.createFolder('/Users/guest/Desktop/untitled folder');

    expect(await renameItemFromField(fileSystem, folder, '   ')).toBeUndefined();
    expect(await renameItemFromField(fileSystem, folder, 'untitled folder')).toBeUndefined();
    expect((await renameItemFromField(fileSystem, folder, '  Notes '))?.path).toBe(
      '/Users/guest/Desktop/Notes',
    );
  });
});
