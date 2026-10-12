import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteSavedDesktopAndReload, reloadPage, App } from './App.tsx';
import { deleteSavedDesktop } from './system/storage/delete-saved-desktop.mts';

// jsdom cannot fetch Vite's asset URLs, so the default-desktop files are served from memory.
vi.mock('./system/seed/seed-content-loader.mts', () => ({
  /**
   * Builds a loader that returns placeholder bytes for every seed file.
   * @returns The fake loader.
   */
  createSeedContentLoader: () => () => Promise.resolve(new TextEncoder().encode('placeholder')),
}));

vi.mock('./system/storage/delete-saved-desktop.mts', () => ({
  deleteSavedDesktop: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('shows the boot screen, then the desktop', async () => {
    render(<App />);

    expect(screen.getByRole('progressbar', { name: 'Starting up' })).toBeInTheDocument();
    expect(
      await screen.findByRole('main', { name: 'khalah.com desktop' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Menu bar' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Dock' })).toBeInTheDocument();
  });
});

describe('recovery actions', () => {
  it('reloads the page', () => {
    const reloadSpy = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      reload: reloadSpy,
    } as unknown as Location);

    reloadPage();

    expect(reloadSpy).toHaveBeenCalled();
  });

  it('deletes the saved desktop before reloading, even when deleting fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const reloadSpy = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      reload: reloadSpy,
    } as unknown as Location);
    vi.mocked(deleteSavedDesktop).mockRejectedValueOnce(new Error('blocked'));

    deleteSavedDesktopAndReload();

    await vi.waitFor(() => {
      expect(reloadSpy).toHaveBeenCalled();
    });
    expect(deleteSavedDesktop).toHaveBeenCalled();
  });
});
