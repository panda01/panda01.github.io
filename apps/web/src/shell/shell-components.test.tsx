import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DesktopSession,
  DesktopSessionOptions,
} from '../system/desktop-session/desktop-session.mts';
import { useDesktopNoticeStore } from '../system/notices/desktop-notice-store.mts';
import {
  endTestDesktopSession,
  loadTestSeedFile,
  renderInDesktopSession,
  startTestDesktopSession,
} from '../test-support/desktop-test-session.tsx';
import { DesktopBootGate } from './boot/DesktopBootGate.tsx';
import { RootErrorBoundary } from './boot/RootErrorBoundary.tsx';
import { DesktopShell, storageUnavailableNotice } from './DesktopShell.tsx';

let desktopSession: DesktopSession;

beforeEach(async () => {
  desktopSession = await startTestDesktopSession();
});

afterEach(async () => {
  vi.restoreAllMocks();
  useDesktopNoticeStore.getState().dismissNotice();
  await endTestDesktopSession(desktopSession);
});

/**
 * Opens the system menu and starts "Reset Desktop…".
 */
async function chooseResetDesktop(): Promise<void> {
  const menuBar = screen.getByRole('navigation', { name: 'Menu bar' });
  await userEvent.click(within(menuBar).getByRole('button', { name: 'System menu' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Reset Desktop…' }));
}

describe('DesktopShell', () => {
  it('shows the menu bar, desktop and Dock', () => {
    renderInDesktopSession(<DesktopShell />, desktopSession);

    expect(screen.getByRole('navigation', { name: 'Menu bar' })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: 'khalah.com desktop' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Dock' })).toBeInTheDocument();
    expect(screen.getByTestId('desktop-wallpaper')).toBeInTheDocument();
  });

  it('warns when the browser will not save changes', async () => {
    renderInDesktopSession(<DesktopShell />, { ...desktopSession, isStoredInBrowser: false });

    expect(await screen.findByText(storageUnavailableNotice)).toBeInTheDocument();
  });

  it('cancels or confirms resetting the desktop', async () => {
    renderInDesktopSession(<DesktopShell />, desktopSession);
    await desktopSession.fileSystem.createFolder('/Users/guest/Desktop/untitled folder');

    await chooseResetDesktop();
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Reset Desktop?' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await vi.waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Reset Desktop?' })).toBeNull();
    });

    await chooseResetDesktop();
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Reset Desktop?' })).getByRole('button', {
        name: 'Reset',
      }),
    );

    await vi.waitFor(async () => {
      expect(await desktopSession.fileSystem.exists('/Users/guest/Desktop/untitled folder')).toBe(
        false,
      );
      expect(screen.queryByRole('progressbar', { name: 'Starting up' })).toBeNull();
    });
  });

  it('reports a failed reset', async () => {
    vi.spyOn(desktopSession, 'resetToDefaultDesktop').mockRejectedValue(
      new Error('Database locked.'),
    );
    renderInDesktopSession(<DesktopShell />, desktopSession);

    await chooseResetDesktop();
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Reset Desktop?' })).getByRole('button', {
        name: 'Reset',
      }),
    );

    expect(
      await screen.findByText("Couldn't reset the desktop. Database locked."),
    ).toBeInTheDocument();
  });
});

describe('DesktopBootGate', () => {
  it('shows the boot screen until the session has started, then the desktop', async () => {
    const startSession = vi.fn<(sessionOptions: DesktopSessionOptions) => Promise<DesktopSession>>(
      () => Promise.resolve(desktopSession),
    );
    render(
      <DesktopBootGate
        startSession={startSession}
        loadSeedFile={loadTestSeedFile}
        minimumBootDurationInMilliseconds={0}
      />,
    );

    expect(screen.getByRole('progressbar', { name: 'Starting up' })).toBeInTheDocument();
    expect(await screen.findByRole('main', { name: 'khalah.com desktop' })).toBeInTheDocument();
    const [usedSessionOptions] = startSession.mock.calls[0] ?? [];
    expect(usedSessionOptions?.loadSeedFile).toBe(loadTestSeedFile);
    expect(usedSessionOptions?.initialDesktopAreaSize.width).toBeGreaterThan(0);
  });

  it('offers to reload or reset when the desktop cannot start', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onReload = vi.fn();
    const onResetDesktop = vi.fn();
    render(
      <DesktopBootGate
        startSession={() => Promise.reject(new Error('Storage is corrupted.'))}
        minimumBootDurationInMilliseconds={0}
        onReload={onReload}
        onResetDesktop={onResetDesktop}
      />,
    );

    const failureMessage = await screen.findByRole('alert');
    expect(failureMessage).toHaveTextContent('The desktop could not start');
    expect(failureMessage).toHaveTextContent('Storage is corrupted.');
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset Desktop' }));
    expect(onReload).toHaveBeenCalledOnce();
    expect(onResetDesktop).toHaveBeenCalledOnce();
  });

  it('describes failures that are not Error objects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Some libraries reject with plain strings; typed as Error only to satisfy the promise type.
    const plainTextFailure = 'plain text failure' as unknown as Error;
    render(
      <DesktopBootGate
        startSession={() => Promise.reject(plainTextFailure)}
        minimumBootDurationInMilliseconds={0}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('plain text failure');
  });

  it('ignores a session that finishes starting after the gate unmounted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let finishStarting: (startedSession: DesktopSession) => void = vi.fn();
    let failStarting: (startupError: Error) => void = vi.fn();
    const { unmount: unmountSuccessfulGate } = render(
      <DesktopBootGate
        startSession={() =>
          new Promise<DesktopSession>((resolveStart) => {
            finishStarting = resolveStart;
          })
        }
        minimumBootDurationInMilliseconds={0}
      />,
    );
    const { unmount: unmountFailingGate } = render(
      <DesktopBootGate
        startSession={() =>
          new Promise<DesktopSession>((_resolveStart, rejectStart) => {
            failStarting = rejectStart;
          })
        }
        minimumBootDurationInMilliseconds={0}
      />,
    );

    unmountSuccessfulGate();
    unmountFailingGate();
    finishStarting(desktopSession);
    failStarting(new Error('too late'));
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));

    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('RootErrorBoundary', () => {
  it('offers to reload or reset after a crash', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    /**
     * A component that always crashes.
     */
    function CrashingDesktop(): never {
      throw new Error('Everything broke.');
    }
    const onReload = vi.fn();
    const onResetDesktop = vi.fn();
    render(
      <RootErrorBoundary onReload={onReload} onResetDesktop={onResetDesktop}>
        <CrashingDesktop />
      </RootErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('alert')).toHaveTextContent('Everything broke.');
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset Desktop' }));
    expect(onReload).toHaveBeenCalledOnce();
    expect(onResetDesktop).toHaveBeenCalledOnce();
  });

  it('renders the desktop normally when nothing crashes', () => {
    render(
      <RootErrorBoundary onReload={vi.fn()} onResetDesktop={vi.fn()}>
        <p>Desktop</p>
      </RootErrorBoundary>,
    );

    expect(screen.getByText('Desktop')).toBeInTheDocument();
  });
});
