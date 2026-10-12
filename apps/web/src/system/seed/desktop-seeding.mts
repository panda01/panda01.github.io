import { getParentPath } from '../fs/path-utilities.mts';
import type { VirtualFileSystem } from '../fs/virtual-file-system.mts';
import type { DesktopDatabase } from '../storage/desktop-database.mts';
import type { SeedEntry } from './default-desktop-seed.mts';

/** Key of the `meta` row that remembers which seed version this visitor has. */
export const seedVersionMetaKey = 'seedVersion';

/** Key of the `meta` row listing every seed path already delivered to this visitor. */
export const seededItemPathsMetaKey = 'seededItemPaths';

/** Loads the bytes of a seed file given its path inside the repository's `content/` folder. */
export type SeedFileLoader = (contentSourcePath: string) => Promise<Uint8Array>;

/** What seeding did: nothing (already current), a first-time seed, or an upgrade of an older seed. */
export type SeedingOutcome = 'already-current' | 'seeded' | 'upgraded';

/** Everything seeding needs, passed in so tests can use small fake seeds. */
export interface SeedingDependencies {
  database: DesktopDatabase;
  fileSystem: VirtualFileSystem;
  seedEntries: readonly SeedEntry[];
  seedVersion: number;
  loadSeedFile: SeedFileLoader;
}

/**
 * Computes a short fingerprint of file content (32-bit FNV-1a hash plus the length). It only needs to
 * tell "same content" from "changed content", not resist tampering.
 * @param fileContent - The bytes to fingerprint.
 * @returns A fingerprint such as "811c9dc5-0".
 */
export function computeContentFingerprint(fileContent: Uint8Array): string {
  let runningHash = 0x811c9dc5;
  for (const contentByte of fileContent) {
    runningHash ^= contentByte;
    runningHash = Math.imul(runningHash, 0x01000193) >>> 0;
  }
  return `${runningHash.toString(16).padStart(8, '0')}-${String(fileContent.byteLength)}`;
}

/**
 * Brings a visitor's desktop up to the current seed.
 * - First visit: every seed item is created.
 * - Seed version increased: seed items this visitor has never received are added, and previously
 *   seeded files the visitor never changed are updated to the new content. Anything the visitor
 *   created, edited, renamed or deleted is left alone (deleted seed items do not come back).
 * @param seedingDependencies - The database, filesystem, seed definition, and file loader.
 * @returns What was done.
 */
export async function seedDesktop(
  seedingDependencies: SeedingDependencies,
): Promise<SeedingOutcome> {
  const { database, fileSystem, seedEntries, seedVersion } = seedingDependencies;
  const storedSeedVersion = (await database.meta.get(seedVersionMetaKey))?.value;
  if (storedSeedVersion === seedVersion) {
    return 'already-current';
  }

  await fileSystem.ensureRootFolder();
  const storedSeededPaths = (await database.meta.get(seededItemPathsMetaKey))?.value;
  const previouslySeededPaths = new Set(Array.isArray(storedSeededPaths) ? storedSeededPaths : []);
  for (const seedEntry of seedEntries) {
    await applySeedEntry(seedEntry, seedingDependencies, previouslySeededPaths.has(seedEntry.path));
  }

  const allDeliveredSeedPaths = [
    ...new Set([...previouslySeededPaths, ...seedEntries.map((seedEntry) => seedEntry.path)]),
  ];
  await database.meta.bulkPut([
    { key: seededItemPathsMetaKey, value: allDeliveredSeedPaths },
    { key: seedVersionMetaKey, value: seedVersion },
  ]);
  return storedSeedVersion === undefined ? 'seeded' : 'upgraded';
}

/**
 * Deletes everything the visitor has (files, windows, settings) and seeds the default desktop again.
 * @param seedingDependencies - The database, filesystem, seed definition, and file loader.
 * @returns Resolves once the desktop is back to its default state.
 */
export async function resetDesktop(seedingDependencies: SeedingDependencies): Promise<void> {
  const { database } = seedingDependencies;
  await database.transaction(
    'rw',
    [database.nodes, database.windows, database.settings, database.meta],
    async () => {
      await Promise.all([
        database.nodes.clear(),
        database.windows.clear(),
        database.settings.clear(),
        database.meta.clear(),
      ]);
    },
  );
  await seedDesktop(seedingDependencies);
}

/**
 * Creates a seed item this visitor has never received, or refreshes a previously seeded file that
 * the visitor has not changed.
 * @param seedEntry - The item to apply.
 * @param seedingDependencies - The filesystem and file loader.
 * @param wasSeededBefore - Whether an earlier seed already delivered this path to the visitor.
 * @returns Resolves once the item is applied (or deliberately skipped).
 */
async function applySeedEntry(
  seedEntry: SeedEntry,
  seedingDependencies: SeedingDependencies,
  wasSeededBefore: boolean,
): Promise<void> {
  const { fileSystem } = seedingDependencies;
  const existingItem = await fileSystem.findItem(seedEntry.path);
  const shouldCreateItem = !wasSeededBefore && existingItem === undefined;

  if (seedEntry.kind === 'folder') {
    if (shouldCreateItem) {
      await fileSystem.createFolder(seedEntry.path, { createMissingParents: true });
    }
    return;
  }

  if (seedEntry.kind === 'link') {
    if (shouldCreateItem) {
      await fileSystem.createFolder(getParentPath(seedEntry.path), { createMissingParents: true });
      await fileSystem.createLink(seedEntry.path, seedEntry.linkTarget);
    }
    return;
  }

  const seedFileContent = await seedingDependencies.loadSeedFile(seedEntry.contentSourcePath);
  const seedFileFingerprint = computeContentFingerprint(seedFileContent);
  if (shouldCreateItem) {
    await fileSystem.createFolder(getParentPath(seedEntry.path), { createMissingParents: true });
    await fileSystem.writeFile(seedEntry.path, seedFileContent, seedEntry.mimeType);
    await fileSystem.setSeedFingerprint(seedEntry.path, seedFileFingerprint);
    return;
  }

  const isOutdatedSeededFile =
    existingItem?.kind === 'file' &&
    existingItem.seedFingerprint !== undefined &&
    existingItem.seedFingerprint !== seedFileFingerprint;
  const hasVisitorKeptSeededContent =
    isOutdatedSeededFile &&
    computeContentFingerprint(await fileSystem.readFileBytes(seedEntry.path)) ===
      existingItem.seedFingerprint;
  if (hasVisitorKeptSeededContent) {
    await fileSystem.writeFile(seedEntry.path, seedFileContent, seedEntry.mimeType);
    await fileSystem.setSeedFingerprint(seedEntry.path, seedFileFingerprint);
  }
}
