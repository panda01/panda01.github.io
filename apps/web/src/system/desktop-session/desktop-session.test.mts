import { Dexie } from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTestSeedFile, testDesktopAreaSize } from '../../test-support/desktop-test-session.tsx';
import { startDesktopSession } from './desktop-session.mts';
import type { DesktopSession } from './desktop-session.mts';

const startedSessions: DesktopSession[] = [];

/**
 * Starts a session on a named test database and remembers it for cleanup.
 * @param databaseName - The database to use.
 * @returns The running session.
 */
async function startNamedSession(databaseName: string): Promise<DesktopSession> {
  const desktopSession = await startDesktopSession({
    databaseName,
    loadSeedFile: loadTestSeedFile,
    initialDesktopAreaSize: testDesktopAreaSize,
    storageManager: undefined,
  });
  startedSessions.push(desktopSession);
  return desktopSession;
}

afterEach(async () => {
  for (const startedSession of startedSessions.splice(0)) {
    startedSession.endSession();
    await Dexie.delete(startedSession.database.name);
  }
  vi.restoreAllMocks();
});

describe('startDesktopSession', () => {
  it('seeds the default desktop on first start', async () => {
    const desktopSession = await startNamedSession(`session-test-${String(Math.random())}`);

    expect(desktopSession.isStoredInBrowser).toBe(true);
    expect(await desktopSession.fileSystem.exists('/Users/guest/Desktop/About Me.txt')).toBe(true);
    expect(desktopSession.windowManagerStore.getState().windowStackOrder).toEqual([]);
  });

  it('restores the saved window layout on the next start', async () => {
    const databaseName = `session-test-${String(Math.random())}`;
    const firstSession = await startNamedSession(databaseName);
    firstSession.windowManagerStore.getState().openWindow({
      appId: 'about-this-mac',
      title: 'About This Mac',
      defaultSize: { width: 440, height: 320 },
      allowsMultipleWindows: false,
    });
    await vi.waitFor(async () => {
      expect(await firstSession.database.windows.count()).toBe(1);
    });
    firstSession.endSession();

    const secondSession = await startNamedSession(databaseName);

    expect(Object.values(secondSession.windowManagerStore.getState().windowsById)).toEqual([
      expect.objectContaining({ appId: 'about-this-mac', title: 'About This Mac' }),
    ]);
  });

  it('resets to the default desktop, closing windows and removing visitor changes', async () => {
    const desktopSession = await startNamedSession(`session-test-${String(Math.random())}`);
    await desktopSession.fileSystem.createFolder('/Users/guest/Desktop/untitled folder');
    desktopSession.windowManagerStore.getState().openWindow({
      appId: 'about-this-mac',
      title: 'About This Mac',
      defaultSize: { width: 440, height: 320 },
      allowsMultipleWindows: false,
    });

    await desktopSession.resetToDefaultDesktop();

    expect(await desktopSession.fileSystem.exists('/Users/guest/Desktop/untitled folder')).toBe(
      false,
    );
    expect(await desktopSession.fileSystem.exists('/Users/guest/Desktop/Resume.pdf')).toBe(true);
    expect(desktopSession.windowManagerStore.getState().windowStackOrder).toEqual([]);
  });

  it('closes the database when the session ends', async () => {
    const desktopSession = await startNamedSession(`session-test-${String(Math.random())}`);

    desktopSession.endSession();

    expect(desktopSession.database.isOpen()).toBe(false);
  });

  it('uses the default database name when none is given', async () => {
    const desktopSession = await startDesktopSession({
      loadSeedFile: loadTestSeedFile,
      initialDesktopAreaSize: testDesktopAreaSize,
      storageManager: undefined,
    });
    startedSessions.push(desktopSession);

    expect(desktopSession.database.name).toBe('khalah-desktop');
  });
});
