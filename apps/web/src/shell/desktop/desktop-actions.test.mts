import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { VirtualFileSystem } from '../../system/fs/virtual-file-system.mts';
import { DesktopDatabase } from '../../system/storage/desktop-database.mts';
import {
  canOpenItem,
  createUntitledFolder,
  openDesktopItem,
  openUrlInNewBrowserTab,
  untitledFolderName,
} from './desktop-actions.mts';
import { listDesktopMenuActions } from './desktop-menu.mts';

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

const webLink = buildItem({
  kind: 'link',
  linkTarget: { kind: 'url', url: 'https://example.com/' },
});
const folderAlias = buildItem({ kind: 'link', linkTarget: { kind: 'path', path: '/Users/guest' } });
const textFile = buildItem({ name: 'Notes.txt' });

let testDatabase: DesktopDatabase;
let fileSystem: VirtualFileSystem;

beforeEach(async () => {
  testDatabase = new DesktopDatabase(`desktop-actions-test-${String(Math.random())}`);
  fileSystem = new VirtualFileSystem(testDatabase);
  await fileSystem.ensureRootFolder();
  await fileSystem.createFolder('/Users/guest/Desktop', { createMissingParents: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
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

describe('opening desktop items', () => {
  it('opens web links in a new browser tab', () => {
    const openUrl = vi.fn();

    expect(canOpenItem(webLink)).toBe(true);
    expect(openDesktopItem(webLink, openUrl)).toBe(true);
    expect(openUrl).toHaveBeenCalledWith('https://example.com/');
  });

  it('does not open files, folders or aliases yet (Finder arrives in Phase 2)', () => {
    const openUrl = vi.fn();

    for (const unopenableItem of [textFile, folderAlias, buildItem({ kind: 'folder' })]) {
      expect(canOpenItem(unopenableItem)).toBe(false);
      expect(openDesktopItem(unopenableItem, openUrl)).toBe(false);
    }
    expect(openUrl).not.toHaveBeenCalled();
  });

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

describe('listDesktopMenuActions', () => {
  it('offers New Folder on empty desktop space', () => {
    expect(listDesktopMenuActions(undefined)).toEqual([
      { actionId: 'new-folder', label: 'New Folder', isDisabled: false },
    ]);
  });

  it('offers Open, Get Info and Move to Trash on an item, enabling Open only when it works', () => {
    expect(
      listDesktopMenuActions(webLink).map(({ label, isDisabled }) => [label, isDisabled]),
    ).toEqual([
      ['Open', false],
      ['Get Info', false],
      ['Move to Trash', false],
    ]);
    expect(listDesktopMenuActions(textFile)[0]?.isDisabled).toBe(true);
  });
});
