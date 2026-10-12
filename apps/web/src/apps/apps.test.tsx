import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DesktopSession } from '../system/desktop-session/desktop-session.mts';
import type { FileSystemItem } from '../system/fs/file-system.types.mts';
import {
  endTestDesktopSession,
  renderInDesktopSession,
  startTestDesktopSession,
} from '../test-support/desktop-test-session.tsx';
import { AboutThisMac } from './about-this-mac/AboutThisMac.tsx';
import { GetInfo, buildItemInfoRows } from './get-info/GetInfo.tsx';

let desktopSession: DesktopSession;

beforeEach(async () => {
  desktopSession = await startTestDesktopSession();
});

afterEach(async () => {
  await endTestDesktopSession(desktopSession);
});

describe('AboutThisMac', () => {
  it('shows the site name, credits and that changes are saved', () => {
    renderInDesktopSession(<AboutThisMac />, desktopSession);

    expect(screen.getByRole('heading', { name: 'khalah.com' })).toBeInTheDocument();
    expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
    expect(screen.getByText('Not affiliated with or endorsed by Apple Inc.')).toBeInTheDocument();
  });

  it('says when the browser refuses to save changes', () => {
    renderInDesktopSession(<AboutThisMac />, { ...desktopSession, isStoredInBrowser: false });

    expect(screen.getByText('Not saved (this browser blocks site storage)')).toBeInTheDocument();
  });
});

describe('buildItemInfoRows', () => {
  const baseItem: FileSystemItem = {
    id: 'x',
    parentId: 'p',
    name: 'Notes.txt',
    path: '/Users/guest/Desktop/Notes.txt',
    kind: 'file',
    mimeType: 'text/plain',
    sizeInBytes: 1500,
    createdAt: new Date(2026, 9, 11, 9, 41).getTime(),
    modifiedAt: new Date(2026, 9, 11, 9, 41).getTime(),
  };

  it('describes files with their size and location', () => {
    expect(buildItemInfoRows(baseItem)).toEqual([
      ['Kind', 'Plain Text Document'],
      ['Size', '1.5 KB'],
      ['Where', '/Users/guest/Desktop'],
      ['Created', 'Sunday, October 11, 2026 at 9:41 AM'],
      ['Modified', 'Sunday, October 11, 2026 at 9:41 AM'],
    ]);
  });

  it('describes where web links and aliases point', () => {
    const webLinkRows = buildItemInfoRows({
      ...baseItem,
      kind: 'link',
      linkTarget: { kind: 'url', url: 'https://example.com/' },
    });
    const aliasRows = buildItemInfoRows({
      ...baseItem,
      kind: 'link',
      linkTarget: { kind: 'path', path: '/Users/guest/Projects' },
    });

    expect(webLinkRows).toContainEqual(['Points to', 'https://example.com/']);
    expect(webLinkRows.map(([rowLabel]) => rowLabel)).not.toContain('Size');
    expect(aliasRows).toContainEqual(['Points to', '/Users/guest/Projects']);
  });
});

describe('GetInfo', () => {
  it('shows a loading indicator, then the item’s details', async () => {
    renderInDesktopSession(
      <GetInfo windowId="w1" launchArgument="/Users/guest/Desktop/About Me.txt" />,
      desktopSession,
    );

    expect(
      screen.getByRole('progressbar', { name: 'Loading item information' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'About Me.txt' })).toBeInTheDocument();
    expect(screen.getByText('Plain Text Document')).toBeInTheDocument();
  });

  it('notices when the item is deleted while the window is open', async () => {
    renderInDesktopSession(
      <GetInfo windowId="w1" launchArgument="/Users/guest/Desktop/About Me.txt" />,
      desktopSession,
    );
    await screen.findByRole('heading', { name: 'About Me.txt' });

    await desktopSession.fileSystem.moveToTrash('/Users/guest/Desktop/About Me.txt');

    expect(await screen.findByRole('status')).toHaveTextContent('This item no longer exists.');
  });

  it('describes the root folder when opened without an item', async () => {
    renderInDesktopSession(<GetInfo windowId="w1" />, desktopSession);

    expect(await screen.findByText('Folder')).toBeInTheDocument();
  });
});
