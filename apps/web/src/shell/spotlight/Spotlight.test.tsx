import { act, fireEvent, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appManifests,
  finderAppId,
  quickLookAppId,
} from '../../system/app-registry/app-registry.mts';
import type { DesktopSession } from '../../system/desktop-session/desktop-session.mts';
import type { FileSystemItem } from '../../system/fs/file-system.types.mts';
import {
  endTestDesktopSession,
  renderInDesktopSession,
  startTestDesktopSession,
} from '../../test-support/desktop-test-session.tsx';
import {
  buildSpotlightEntries,
  createSpotlightSearch,
  spotlightResultLimit,
} from './spotlight-search.mts';
import { useSpotlightStore } from './spotlight-store.mts';
import { Spotlight } from './Spotlight.tsx';

/**
 * Builds a filesystem item from a path.
 * @param itemPath - The item's path.
 * @param overrides - Fields to change.
 * @returns The item.
 */
function buildItem(itemPath: string, overrides: Partial<FileSystemItem> = {}): FileSystemItem {
  return {
    id: itemPath,
    parentId: 'p',
    name: itemPath.slice(itemPath.lastIndexOf('/') + 1),
    path: itemPath,
    kind: 'file',
    mimeType: 'text/plain',
    sizeInBytes: 1,
    createdAt: 0,
    modifiedAt: 0,
    ...overrides,
  };
}

describe('Spotlight search', () => {
  const allItems = [
    buildItem('/Users/guest/Desktop/Resume.pdf', { mimeType: 'application/pdf' }),
    buildItem('/Users/guest/Desktop/About Me.txt'),
    buildItem('/Users/guest/.Trash/Old Resume.pdf', { mimeType: 'application/pdf' }),
    buildItem('/Users/guest/.config/settings.txt'),
  ];

  it('lists launchable apps and visible items, leaving out hidden and trashed ones', () => {
    const spotlightEntries = buildSpotlightEntries(appManifests, allItems);

    expect(spotlightEntries.map((spotlightEntry) => spotlightEntry.title)).toEqual([
      'Finder',
      'About This Mac',
      'Resume.pdf',
      'About Me.txt',
    ]);
    expect(spotlightEntries[2]?.subtitle).toBe('PDF Document — Desktop');
    expect(spotlightEntries[0]?.subtitle).toBe('Application');
  });

  it('finds names despite a typo, and finds nothing for empty text', () => {
    const searchSpotlight = createSpotlightSearch(buildSpotlightEntries(appManifests, allItems));

    expect(searchSpotlight('rsume').map((spotlightEntry) => spotlightEntry.title)).toEqual([
      'Resume.pdf',
    ]);
    expect(searchSpotlight('finder').map((spotlightEntry) => spotlightEntry.title)).toEqual([
      'Finder',
    ]);
    expect(searchSpotlight('   ')).toEqual([]);
  });

  it('lists at most a dozen results', () => {
    const manyNotes = Array.from({ length: 30 }, (_, noteIndex) =>
      buildItem(`/Users/guest/Documents/Note ${String(noteIndex)}.txt`),
    );
    const searchSpotlight = createSpotlightSearch(buildSpotlightEntries([], manyNotes));

    expect(searchSpotlight('note')).toHaveLength(spotlightResultLimit);
  });
});

describe('Spotlight', () => {
  let desktopSession: DesktopSession;

  beforeEach(async () => {
    desktopSession = await startTestDesktopSession();
    renderInDesktopSession(<Spotlight />, desktopSession);
  });

  afterEach(async () => {
    act(() => {
      useSpotlightStore.getState().closeSpotlight();
    });
    await endTestDesktopSession(desktopSession);
  });

  /**
   * Opens Spotlight and returns its search field.
   * @returns The search field.
   */
  async function openSpotlight(): Promise<HTMLElement> {
    act(() => {
      useSpotlightStore.getState().openSpotlight();
    });
    return screen.findByRole('combobox', { name: 'Spotlight Search' });
  }

  /**
   * Lists the open windows of an app by launch argument.
   * @param appId - The app.
   * @returns The launch arguments of its windows.
   */
  function listLaunchArgumentsOf(appId: string): (string | undefined)[] {
    return Object.values(desktopSession.windowManagerStore.getState().windowsById)
      .filter((openWindow) => openWindow.appId === appId)
      .map((openWindow) => openWindow.launchArgument);
  }

  it('finds a file as you type and previews it on Enter', async () => {
    const searchField = await openSpotlight();
    expect(searchField).toHaveFocus();

    await userEvent.type(searchField, 'resume');
    expect(await screen.findByRole('option', { name: /Resume\.pdf/ })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');

    expect(listLaunchArgumentsOf(quickLookAppId)).toEqual(['/Users/guest/Desktop/Resume.pdf']);
    expect(useSpotlightStore.getState().isSpotlightOpen).toBe(false);
  });

  it('launches applications and opens folders in Finder', async () => {
    await userEvent.type(await openSpotlight(), 'finder');
    await screen.findByRole('option', { name: /Application/ });
    await userEvent.keyboard('{Enter}');
    expect(listLaunchArgumentsOf(finderAppId)).toHaveLength(1);

    await userEvent.type(await openSpotlight(), 'downloads');
    await userEvent.click(await screen.findByRole('option', { name: /^Downloads/ }));
    expect(listLaunchArgumentsOf(finderAppId)).toContain('/Users/guest/Downloads');
  });

  it('closes with Escape or a click elsewhere, starting empty each time', async () => {
    await userEvent.type(await openSpotlight(), 'abc');
    await userEvent.keyboard('{Escape}');
    expect(useSpotlightStore.getState().isSpotlightOpen).toBe(false);

    const reopenedSearchField = await openSpotlight();
    expect(reopenedSearchField).toHaveValue('');
    const invisibleBackdrop = document.querySelector('.MuiBackdrop-root');
    if (invisibleBackdrop === null) {
      throw new Error('Spotlight has no backdrop.');
    }
    fireEvent.click(invisibleBackdrop);
    expect(useSpotlightStore.getState().isSpotlightOpen).toBe(false);
  });

  it('toggles open and closed', () => {
    act(() => {
      useSpotlightStore.getState().toggleSpotlight();
    });
    expect(useSpotlightStore.getState().isSpotlightOpen).toBe(true);
    act(() => {
      useSpotlightStore.getState().toggleSpotlight();
    });
    expect(useSpotlightStore.getState().isSpotlightOpen).toBe(false);
  });
});
