import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { DesktopSessionProvider } from '../../system/desktop-session/desktop-session-context.tsx';
import { startDesktopSession } from '../../system/desktop-session/desktop-session.mts';
import type {
  DesktopSession,
  DesktopSessionOptions,
} from '../../system/desktop-session/desktop-session.mts';
import type { SeedFileLoader } from '../../system/seed/desktop-seeding.mts';
import { createSeedContentLoader } from '../../system/seed/seed-content-loader.mts';
import { menuBarHeightInPixels } from '../../system/window-manager/window-geometry.mts';
import { DesktopShell } from '../DesktopShell.tsx';
import { BootScreen } from './BootScreen.tsx';

/** Shortest time the boot screen stays up, so it reads as a deliberate start-up, not a flicker. */
export const defaultMinimumBootDurationInMilliseconds = 700;

/** Props for the boot gate; tests replace the session starter and seed loader. */
export interface DesktopBootGateProps {
  startSession?: (sessionOptions: DesktopSessionOptions) => Promise<DesktopSession>;
  loadSeedFile?: SeedFileLoader;
  minimumBootDurationInMilliseconds?: number;
  /** Shown on the start-up failure screen; reloads the page by default. */
  onReload?: () => void;
  /** Shown on the start-up failure screen; deletes the saved desktop and reloads by default. */
  onResetDesktop?: () => void;
}

type BootState =
  | { status: 'booting' }
  | { status: 'ready'; desktopSession: DesktopSession }
  | { status: 'failed'; startupError: unknown };

/**
 * Measures the area windows can use before the desktop has rendered (the viewport minus the menu bar).
 * @returns The initial desktop area size.
 */
export function measureInitialDesktopAreaSize(): { width: number; height: number } {
  return {
    width: window.innerWidth,
    height: Math.max(window.innerHeight - menuBarHeightInPixels, 0),
  };
}

/**
 * Waits for a number of milliseconds.
 * @param waitDuration - How long to wait.
 * @returns Resolves after the wait.
 */
function waitMilliseconds(waitDuration: number): Promise<void> {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, waitDuration);
  });
}

/**
 * Shows the boot screen while the visitor's desktop starts, then the desktop; if start-up fails,
 * shows a recovery screen. The session is started once even when React runs effects twice in
 * development (StrictMode), so the default desktop is never seeded twice at the same time.
 * @param props - Optional replacements for tests.
 * @param props.startSession - Starts the desktop session.
 * @param props.loadSeedFile - Loads default-desktop files.
 * @param props.minimumBootDurationInMilliseconds - Shortest boot screen time.
 * @param props.onReload - Reload action for the failure screen.
 * @param props.onResetDesktop - Reset action for the failure screen.
 * @returns The boot screen, the desktop, or the failure screen.
 */
export function DesktopBootGate({
  startSession = startDesktopSession,
  loadSeedFile,
  minimumBootDurationInMilliseconds = defaultMinimumBootDurationInMilliseconds,
  onReload,
  onResetDesktop,
}: DesktopBootGateProps): JSX.Element {
  const [bootState, setBootState] = useState<BootState>({ status: 'booting' });
  const sessionStartRef = useRef<Promise<DesktopSession> | null>(null);

  useEffect(() => {
    let isEffectStillActive = true;
    sessionStartRef.current ??= Promise.all([
      startSession({
        loadSeedFile: loadSeedFile ?? createSeedContentLoader(),
        initialDesktopAreaSize: measureInitialDesktopAreaSize(),
        storageManager: navigator.storage,
      }),
      waitMilliseconds(minimumBootDurationInMilliseconds),
    ]).then(([startedSession]) => startedSession);

    sessionStartRef.current.then(
      (desktopSession) => {
        if (isEffectStillActive) {
          setBootState({ status: 'ready', desktopSession });
        }
      },
      (startupError: unknown) => {
        console.error('The desktop could not start.', startupError);
        if (isEffectStillActive) {
          setBootState({ status: 'failed', startupError });
        }
      },
    );
    return () => {
      isEffectStillActive = false;
    };
  }, [startSession, loadSeedFile, minimumBootDurationInMilliseconds]);

  if (bootState.status === 'booting') {
    return <BootScreen />;
  }
  if (bootState.status === 'failed') {
    const failureDetail =
      bootState.startupError instanceof Error
        ? bootState.startupError.message
        : String(bootState.startupError);
    return (
      <Box
        component="main"
        sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}
      >
        <Stack role="alert" spacing={2} sx={{ maxWidth: 420, textAlign: 'center' }}>
          <Typography component="h1" variant="h6">
            The desktop could not start
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {failureDetail}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
            <Button variant="contained" onClick={onReload}>
              Reload
            </Button>
            <Button color="error" onClick={onResetDesktop}>
              Reset Desktop
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  }
  return (
    <DesktopSessionProvider desktopSession={bootState.desktopSession}>
      <DesktopShell />
    </DesktopSessionProvider>
  );
}
