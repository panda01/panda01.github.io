import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VirtualFileSystem } from '../fs/virtual-file-system.mts';
import { DesktopDatabase } from '../storage/desktop-database.mts';
import type { SeedEntry } from './default-desktop-seed.mts';
import { currentSeedVersion, defaultDesktopSeedEntries } from './default-desktop-seed.mts';
import {
  computeContentFingerprint,
  resetDesktop,
  seedDesktop,
  seededItemPathsMetaKey,
} from './desktop-seeding.mts';
import type { SeedingDependencies } from './desktop-seeding.mts';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
let testDatabase: DesktopDatabase;
let fileSystem: VirtualFileSystem;
let seedFileTexts: Record<string, string>;

/**
 * Serves seed file content from `seedFileTexts`.
 * @param contentSourcePath - The seed file's path inside content/.
 * @returns The file's bytes (empty when the test did not define it).
 */
function loadFakeSeedFile(contentSourcePath: string): Promise<Uint8Array> {
  return Promise.resolve(textEncoder.encode(seedFileTexts[contentSourcePath] ?? ''));
}

/**
 * Builds seeding dependencies around the test database with a given seed.
 * @param seedEntries - The seed to apply.
 * @param seedVersion - The seed's version.
 * @returns Dependencies whose loader serves `seedFileTexts`.
 */
function buildSeedingDependencies(
  seedEntries: readonly SeedEntry[],
  seedVersion: number,
): SeedingDependencies {
  return {
    database: testDatabase,
    fileSystem,
    seedEntries,
    seedVersion,
    loadSeedFile: loadFakeSeedFile,
  };
}

const versionOneSeed: readonly SeedEntry[] = [
  { kind: 'folder', path: '/Users/guest/Desktop' },
  {
    kind: 'file',
    path: '/Users/guest/Desktop/Note.txt',
    contentSourcePath: 'note',
    mimeType: 'text/plain',
  },
  {
    kind: 'link',
    path: '/Users/guest/Desktop/Site',
    linkTarget: { kind: 'url', url: 'https://a.b/' },
  },
];

beforeEach(() => {
  testDatabase = new DesktopDatabase(`seed-test-${String(Math.random())}`);
  fileSystem = new VirtualFileSystem(testDatabase);
  seedFileTexts = { note: 'version one' };
});

afterEach(async () => {
  await testDatabase.delete();
});

describe('computeContentFingerprint', () => {
  it('is stable for equal content and differs for different content', () => {
    expect(computeContentFingerprint(textEncoder.encode('abc'))).toBe(
      computeContentFingerprint(textEncoder.encode('abc')),
    );
    expect(computeContentFingerprint(textEncoder.encode('abc'))).not.toBe(
      computeContentFingerprint(textEncoder.encode('abd')),
    );
    expect(computeContentFingerprint(new Uint8Array())).toBe('811c9dc5-0');
  });
});

describe('seedDesktop', () => {
  it('creates every seed item on the first visit and marks seeded files', async () => {
    expect(await seedDesktop(buildSeedingDependencies(versionOneSeed, 1))).toBe('seeded');

    expect(
      textDecoder.decode(await fileSystem.readFileBytes('/Users/guest/Desktop/Note.txt')),
    ).toBe('version one');
    expect((await fileSystem.getItem('/Users/guest/Desktop/Note.txt')).seedFingerprint).toBe(
      computeContentFingerprint(textEncoder.encode('version one')),
    );
    expect((await fileSystem.getItem('/Users/guest/Desktop/Site')).linkTarget).toEqual({
      kind: 'url',
      url: 'https://a.b/',
    });
  });

  it('does nothing when the seed version is already current', async () => {
    await seedDesktop(buildSeedingDependencies(versionOneSeed, 1));
    await fileSystem.remove('/Users/guest/Desktop/Note.txt');

    expect(await seedDesktop(buildSeedingDependencies(versionOneSeed, 1))).toBe('already-current');
    expect(await fileSystem.exists('/Users/guest/Desktop/Note.txt')).toBe(false);
  });

  it('upgrades unchanged seeded files, keeps edited ones, and adds new seed items', async () => {
    const editedFileSeedEntry: SeedEntry = {
      kind: 'file',
      path: '/Users/guest/Desktop/Edited.txt',
      contentSourcePath: 'edited',
      mimeType: 'text/plain',
    };
    const versionTwoSeed: readonly SeedEntry[] = [
      ...versionOneSeed,
      editedFileSeedEntry,
      { kind: 'folder', path: '/Users/guest/New Folder' },
      {
        kind: 'link',
        path: '/Users/guest/New Folder/Alias',
        linkTarget: { kind: 'path', path: '/' },
      },
    ];
    seedFileTexts.edited = 'seeded text';
    await seedDesktop(buildSeedingDependencies([...versionOneSeed, editedFileSeedEntry], 1));
    await fileSystem.writeFile(
      '/Users/guest/Desktop/Edited.txt',
      textEncoder.encode('my own words'),
    );

    seedFileTexts = { note: 'version two', edited: 'new seeded text' };
    expect(await seedDesktop(buildSeedingDependencies(versionTwoSeed, 2))).toBe('upgraded');

    expect(
      textDecoder.decode(await fileSystem.readFileBytes('/Users/guest/Desktop/Note.txt')),
    ).toBe('version two');
    expect(
      textDecoder.decode(await fileSystem.readFileBytes('/Users/guest/Desktop/Edited.txt')),
    ).toBe('my own words');
    expect(await fileSystem.exists('/Users/guest/New Folder/Alias')).toBe(true);
  });

  it('does not bring back seed items the visitor deleted', async () => {
    await seedDesktop(buildSeedingDependencies(versionOneSeed, 1));
    await fileSystem.moveToTrash('/Users/guest/Desktop/Note.txt');
    await fileSystem.remove('/Users/guest/Desktop/Site');

    seedFileTexts = { note: 'version two' };
    await seedDesktop(buildSeedingDependencies(versionOneSeed, 2));

    expect(await fileSystem.exists('/Users/guest/Desktop/Note.txt')).toBe(false);
    expect(await fileSystem.exists('/Users/guest/Desktop/Site')).toBe(false);
  });

  it('leaves visitor items that occupy a new seed path alone', async () => {
    await fileSystem.ensureRootFolder();
    await fileSystem.createFolder('/Users/guest/Desktop', { createMissingParents: true });
    await fileSystem.createFolder('/Users/guest/Desktop/Note.txt');

    await seedDesktop(buildSeedingDependencies(versionOneSeed, 1));

    expect((await fileSystem.getItem('/Users/guest/Desktop/Note.txt')).kind).toBe('folder');
  });

  it('treats a corrupted list of seeded paths as empty', async () => {
    await testDatabase.meta.put({ key: seededItemPathsMetaKey, value: 'not-a-list' });

    await seedDesktop(buildSeedingDependencies(versionOneSeed, 1));

    expect(await fileSystem.exists('/Users/guest/Desktop/Note.txt')).toBe(true);
  });
});

describe('resetDesktop', () => {
  it('removes visitor changes, windows and settings, then reseeds', async () => {
    await seedDesktop(buildSeedingDependencies(versionOneSeed, 1));
    await fileSystem.createFolder('/Users/guest/Desktop/untitled folder');
    await fileSystem.remove('/Users/guest/Desktop/Note.txt');
    await testDatabase.settings.put({ key: 'wallpaper', value: 'blue' });

    await resetDesktop(buildSeedingDependencies(versionOneSeed, 1));

    expect(await fileSystem.exists('/Users/guest/Desktop/untitled folder')).toBe(false);
    expect(await fileSystem.exists('/Users/guest/Desktop/Note.txt')).toBe(true);
    expect(await testDatabase.settings.count()).toBe(0);
  });
});

describe('default desktop seed', () => {
  it('lists parent folders before their contents and every path once', () => {
    const seedPaths = defaultDesktopSeedEntries.map((seedEntry) => seedEntry.path);
    expect(new Set(seedPaths).size).toBe(seedPaths.length);
    seedPaths.forEach((seedPath, seedIndex) => {
      const parentFolderPath = seedPath.slice(0, seedPath.lastIndexOf('/'));
      const isParentSeededLater = seedPaths.indexOf(parentFolderPath) > seedIndex;
      expect(isParentSeededLater).toBe(false);
    });
    expect(currentSeedVersion).toBeGreaterThanOrEqual(1);
  });

  it("links the desktop's GitHub and LinkedIn shortcuts to the owner's profiles", () => {
    const linkUrlsByPath = Object.fromEntries(
      defaultDesktopSeedEntries.flatMap((seedEntry) =>
        seedEntry.kind === 'link' && seedEntry.linkTarget.kind === 'url'
          ? [[seedEntry.path, seedEntry.linkTarget.url]]
          : [],
      ),
    );
    expect(linkUrlsByPath).toMatchObject({
      '/Users/guest/Desktop/GitHub': 'https://github.com/panda01',
      '/Users/guest/Desktop/LinkedIn': 'https://www.linkedin.com/in/khalahjonesgolden/',
    });
  });
});
