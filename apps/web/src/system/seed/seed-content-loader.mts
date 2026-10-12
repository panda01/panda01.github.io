import type { SeedFileLoader } from './desktop-seeding.mts';

/**
 * URLs of every file in the repository's `content/` folder, keyed by Vite's glob path
 * (for example "../../../../../content/Desktop/About Me.txt"). Vite serves them in development and
 * copies them into the build as assets.
 */
const bundledSeedContentUrls = import.meta.glob<string>('../../../../../content/**/*', {
  query: '?url',
  import: 'default',
  eager: true,
});

/**
 * Creates a loader that fetches seed files by their path inside `content/`.
 * @param seedContentUrlsByGlobPath - Seed file URLs keyed by glob path (defaults to the bundled files).
 * @param fetchResource - The fetch implementation (replaceable in tests).
 * @returns A loader that resolves to a seed file's bytes.
 */
export function createSeedContentLoader(
  seedContentUrlsByGlobPath: Readonly<Record<string, string>> = bundledSeedContentUrls,
  fetchResource: typeof fetch = fetch,
): SeedFileLoader {
  return async function loadSeedFile(contentSourcePath: string): Promise<Uint8Array> {
    const matchingGlobPath = Object.keys(seedContentUrlsByGlobPath).find((globPath) =>
      globPath.endsWith(`/content/${contentSourcePath}`),
    );
    const seedFileUrl =
      matchingGlobPath === undefined ? undefined : seedContentUrlsByGlobPath[matchingGlobPath];
    if (seedFileUrl === undefined) {
      throw new Error(`Seed file content/${contentSourcePath} is not in the build.`);
    }
    const seedFileResponse = await fetchResource(seedFileUrl);
    if (!seedFileResponse.ok) {
      throw new Error(
        `Could not load seed file content/${contentSourcePath} (HTTP ${String(seedFileResponse.status)}).`,
      );
    }
    return new Uint8Array(await seedFileResponse.arrayBuffer());
  };
}
