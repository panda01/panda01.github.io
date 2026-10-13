import { describe, expect, it } from 'vitest';
import {
  aboutThisMacAppId,
  appManifests,
  buildOpenWindowRequest,
  findAppManifest,
  finderAppId,
  getInfoAppId,
  quickLookAppId,
} from './app-registry.mts';
import type { AppManifest } from './app-manifest.types.mts';

/**
 * Looks up a manifest that must exist.
 * @param appId - The app id.
 * @returns The manifest.
 */
function requireAppManifest(appId: string): AppManifest {
  const appManifest = findAppManifest(appId);
  if (appManifest === undefined) {
    throw new Error(`Missing app ${appId}`);
  }
  return appManifest;
}

describe('app registry', () => {
  it('finds known apps and ignores unknown ids', () => {
    expect(requireAppManifest(aboutThisMacAppId).displayName).toBe('About This Mac');
    expect(findAppManifest('no-such-app')).toBeUndefined();
  });

  it('gives every app a unique id', () => {
    const appIds = appManifests.map((appManifest) => appManifest.id);
    expect(new Set(appIds).size).toBe(appIds.length);
  });

  it('titles windows like macOS', () => {
    expect(requireAppManifest(aboutThisMacAppId).createWindowTitle(undefined)).toBe(
      'About This Mac',
    );
    const getInfoManifest = requireAppManifest(getInfoAppId);
    expect(getInfoManifest.createWindowTitle('/Users/guest/Desktop/Resume.pdf')).toBe(
      'Resume.pdf Info',
    );
    expect(getInfoManifest.createWindowTitle(undefined)).toBe('Macintosh HD Info');
    const finderManifest = requireAppManifest(finderAppId);
    expect(finderManifest.createWindowTitle('/Users/guest/Projects')).toBe('Projects');
    expect(finderManifest.createWindowTitle('/')).toBe('Macintosh HD');
    expect(finderManifest.createWindowTitle(undefined)).toBe('guest');
    const quickLookManifest = requireAppManifest(quickLookAppId);
    expect(quickLookManifest.createWindowTitle('/Users/guest/Desktop/Resume.pdf')).toBe(
      'Resume.pdf',
    );
    expect(quickLookManifest.createWindowTitle(undefined)).toBe('Quick Look');
  });

  it('puts Finder first in the Dock and lists only real apps as applications', () => {
    expect(appManifests[0]?.id).toBe(finderAppId);
    expect(
      appManifests
        .filter((appManifest) => appManifest.isListedAsApplication)
        .map((appManifest) => appManifest.displayName),
    ).toEqual(['Finder', 'About This Mac']);
  });

  it('loads every app’s window content on demand', async () => {
    for (const appManifest of appManifests) {
      const loadedModule = await appManifest.loadWindowContent();
      expect(typeof loadedModule.default).toBe('function');
    }
  });
});

describe('buildOpenWindowRequest', () => {
  it('builds a request from the manifest, with or without a launch argument', () => {
    expect(buildOpenWindowRequest(requireAppManifest(aboutThisMacAppId))).toEqual({
      appId: aboutThisMacAppId,
      title: 'About This Mac',
      defaultSize: { width: 440, height: 320 },
      allowsMultipleWindows: false,
    });
    expect(buildOpenWindowRequest(requireAppManifest(getInfoAppId), '/a/b.txt')).toMatchObject({
      title: 'b.txt Info',
      launchArgument: '/a/b.txt',
      allowsMultipleWindows: true,
    });
  });
});
