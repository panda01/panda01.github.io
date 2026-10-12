import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ThemeProvider } from '@mui/material';
import { DesktopSessionProvider } from '../system/desktop-session/desktop-session-context.tsx';
import { startDesktopSession } from '../system/desktop-session/desktop-session.mts';
import type { DesktopSession } from '../system/desktop-session/desktop-session.mts';
import { createDesktopTheme } from '../system/theme/desktop-theme.mts';

/** Desktop area used by component tests (a 1280×720 screen minus the menu bar). */
export const testDesktopAreaSize = { width: 1280, height: 690 };

/**
 * Serves every default-desktop file as a short text, since jsdom cannot fetch Vite asset URLs.
 * @param contentSourcePath - Path of the seed file inside content/.
 * @returns The fake file bytes.
 */
export function loadTestSeedFile(contentSourcePath: string): Promise<Uint8Array> {
  return Promise.resolve(new TextEncoder().encode(`test content for ${contentSourcePath}`));
}

/**
 * Starts a real desktop session (default desktop seeded) in its own fake IndexedDB database.
 * @returns The running session; call `endSession` and delete its database when done.
 */
export function startTestDesktopSession(): Promise<DesktopSession> {
  return startDesktopSession({
    databaseName: `component-test-${String(Math.random())}`,
    loadSeedFile: loadTestSeedFile,
    initialDesktopAreaSize: testDesktopAreaSize,
    storageManager: undefined,
  });
}

/**
 * Stops a test session and deletes its database.
 * @param desktopSession - The session to clean up.
 * @returns Resolves once the database is deleted.
 */
export async function endTestDesktopSession(desktopSession: DesktopSession): Promise<void> {
  desktopSession.endSession();
  await desktopSession.database.delete();
}

/**
 * Renders a component inside the desktop theme and a desktop session.
 * @param componentUnderTest - The element to render.
 * @param desktopSession - The session the component uses.
 * @returns Testing Library's render result.
 */
export function renderInDesktopSession(
  componentUnderTest: ReactElement,
  desktopSession: DesktopSession,
): RenderResult {
  return render(
    <ThemeProvider theme={createDesktopTheme()}>
      <DesktopSessionProvider desktopSession={desktopSession}>
        {componentUnderTest}
      </DesktopSessionProvider>
    </ThemeProvider>,
  );
}
