import { describe, expect, it, vi } from 'vitest';
import { defaultDesktopSeedEntries } from './default-desktop-seed.mts';
import { createSeedContentLoader } from './seed-content-loader.mts';

describe('createSeedContentLoader', () => {
  it('fetches a seed file by its path inside content/', async () => {
    const fakeFetch = vi.fn(() =>
      Promise.resolve(new Response(new TextEncoder().encode('hello'), { status: 200 })),
    );
    const loadSeedFile = createSeedContentLoader(
      { '../../../../../content/Desktop/About Me.txt': '/assets/about.txt' },
      fakeFetch,
    );

    const loadedBytes = await loadSeedFile('Desktop/About Me.txt');

    expect(fakeFetch).toHaveBeenCalledWith('/assets/about.txt');
    expect(new TextDecoder().decode(loadedBytes)).toBe('hello');
  });

  it('reports seed files missing from the build', async () => {
    const loadSeedFile = createSeedContentLoader({}, vi.fn());

    await expect(loadSeedFile('Desktop/Missing.txt')).rejects.toThrow(
      'Seed file content/Desktop/Missing.txt is not in the build.',
    );
  });

  it('reports failed downloads', async () => {
    const loadSeedFile = createSeedContentLoader({ '../content/a.txt': '/a.txt' }, () =>
      Promise.resolve(new Response('', { status: 404 })),
    );

    await expect(loadSeedFile('a.txt')).rejects.toThrow('(HTTP 404)');
  });

  it('bundles every file the default seed refers to', () => {
    const loadSeedFileWithRecordingFetch = vi.fn();
    const seedFilePaths = defaultDesktopSeedEntries.flatMap((seedEntry) =>
      seedEntry.kind === 'file' ? [seedEntry.contentSourcePath] : [],
    );
    const loadSeedFile = createSeedContentLoader(undefined, loadSeedFileWithRecordingFetch);

    for (const seedFilePath of seedFilePaths) {
      void loadSeedFile(seedFilePath).catch(() => undefined);
    }

    expect(loadSeedFileWithRecordingFetch).toHaveBeenCalledTimes(seedFilePaths.length);
  });
});
