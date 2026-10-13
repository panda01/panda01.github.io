// fuse.js only has a default export, so it cannot be imported by name.
import Fuse from 'fuse.js';
import type { AppManifest } from '../../system/app-registry/app-manifest.types.mts';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import { describeItemKind } from '../../system/fs/item-presentation.mts';
import {
  getFolderDisplayName,
  getParentPath,
  isHiddenItemName,
  isPathInsideFolder,
  splitPathIntoNames,
  trashFolderPath,
} from '../../system/fs/path-utilities.mts';

/** The most results Spotlight lists at once. */
export const spotlightResultLimit = 12;

/**
 * How closely a name must match: 0 is exact, 1 matches anything. 0.3 forgives a typo ("rsume"
 * finds "Resume.pdf", "linkdin" finds "LinkedIn") without listing unrelated names; at 0.4,
 * "finder" also listed every folder because their kind is "Folder" (Phase 2 walkthrough).
 */
const fuzzyMatchThreshold = 0.3;

/** One thing Spotlight can find: an application, or a file, folder or link. */
export type SpotlightEntry =
  | {
      kind: 'application';
      entryKey: string;
      title: string;
      subtitle: string;
      appManifest: AppManifest;
    }
  | { kind: 'item'; entryKey: string; title: string; subtitle: string; item: FileSystemItem };

/**
 * Builds everything Spotlight can find: the visitor-launchable applications, then every file,
 * folder and link except hidden ones and anything in the Trash (like macOS).
 * @param appManifests - Every known app.
 * @param allItems - Every filesystem item.
 * @returns The searchable entries.
 */
export function buildSpotlightEntries(
  appManifests: readonly AppManifest[],
  allItems: readonly FileSystemItem[],
): SpotlightEntry[] {
  const applicationEntries: SpotlightEntry[] = appManifests
    .filter((appManifest) => appManifest.isListedAsApplication)
    .map((appManifest) => ({
      kind: 'application',
      entryKey: `application:${appManifest.id}`,
      title: appManifest.displayName,
      subtitle: 'Application',
      appManifest,
    }));
  const itemEntries: SpotlightEntry[] = allItems
    .filter((item) => {
      const isHiddenOrInsideHiddenFolder = splitPathIntoNames(item.path).some(isHiddenItemName);
      const isInTrash = isPathInsideFolder(item.path, trashFolderPath);
      return !isHiddenOrInsideHiddenFolder && !isInTrash;
    })
    .map((item) => ({
      kind: 'item',
      entryKey: `item:${item.id}`,
      title: item.name,
      subtitle: `${describeItemKind(item)} — ${getFolderDisplayName(getParentPath(item.path))}`,
      item,
    }));
  return [...applicationEntries, ...itemEntries];
}

/**
 * Creates Spotlight's search over a set of entries. Names count most; the kind and folder
 * ("PDF Document — Desktop") help too. Matching is fuzzy, so small typos still find things.
 * @param spotlightEntries - Everything that can be found.
 * @returns A function from typed text to the best matches, best first.
 */
export function createSpotlightSearch(
  spotlightEntries: readonly SpotlightEntry[],
): (searchText: string) => SpotlightEntry[] {
  const fuzzySearch = new Fuse(spotlightEntries, {
    keys: [
      { name: 'title', weight: 3 },
      { name: 'subtitle', weight: 1 },
    ],
    threshold: fuzzyMatchThreshold,
    ignoreLocation: true,
  });
  return (searchText) => {
    const trimmedSearchText = searchText.trim();
    if (trimmedSearchText === '') {
      return [];
    }
    return fuzzySearch
      .search(trimmedSearchText, { limit: spotlightResultLimit })
      .map((searchResult) => searchResult.item);
  };
}
