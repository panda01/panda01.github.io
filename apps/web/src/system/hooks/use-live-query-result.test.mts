import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DesktopDatabase } from '../storage/desktop-database.mts';
import { useLiveQueryResult } from './use-live-query-result.mts';

const testDatabase = new DesktopDatabase(`live-query-test-${String(Math.random())}`);

afterEach(async () => {
  await testDatabase.settings.clear();
});

/**
 * Counts settings rows; used as the live query under test.
 * @returns The number of settings rows.
 */
function countSettings(): Promise<number> {
  return testDatabase.settings.count();
}

describe('useLiveQueryResult', () => {
  it('starts with the initial value, then follows the database as it changes', async () => {
    const { result } = renderHook(() => useLiveQueryResult(countSettings, -1));
    expect(result.current).toEqual({ value: -1, error: undefined, isLoaded: false });

    await waitFor(() => {
      expect(result.current).toEqual({ value: 0, error: undefined, isLoaded: true });
    });
    await testDatabase.settings.put({ key: 'theme', value: 'dark' });
    await waitFor(() => {
      expect(result.current.value).toBe(1);
    });
  });

  it('reports query errors while keeping the last value', async () => {
    const queryError = new Error('query failed');
    /**
     * A query that always fails.
     * @returns A rejected promise.
     */
    const failingQuery = () => Promise.reject(queryError);

    const { result } = renderHook(() => useLiveQueryResult(failingQuery, 'fallback'));

    await waitFor(() => {
      expect(result.current).toEqual({ value: 'fallback', error: queryError, isLoaded: true });
    });
  });

  // Regression (Phase 1 E2E): a Dexie live query ended for good after one failed run, so the desktop
  // stayed empty after "Reset Desktop" briefly removed the Desktop folder.
  it('keeps following the database after a run fails', async () => {
    /**
     * Fails while the "broken" setting exists, otherwise counts settings.
     * @returns The number of settings rows.
     */
    const sometimesFailingQuery = async () => {
      if ((await testDatabase.settings.get('broken')) !== undefined) {
        throw new Error('temporarily broken');
      }
      return testDatabase.settings.count();
    };
    const { result } = renderHook(() => useLiveQueryResult(sometimesFailingQuery, -1));
    await waitFor(() => {
      expect(result.current.value).toBe(0);
    });

    await testDatabase.settings.put({ key: 'broken', value: true });
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
    expect(result.current.value).toBe(0);

    await testDatabase.settings.delete('broken');
    await testDatabase.settings.put({ key: 'theme', value: 'dark' });
    await waitFor(() => {
      expect(result.current).toEqual({ value: 1, error: undefined, isLoaded: true });
    });
  });

  it('shows the initial value again while a new query has not answered yet', async () => {
    await testDatabase.settings.put({ key: 'theme', value: 'dark' });
    /**
     * Counts settings twice over, as a second, different query.
     * @returns Twice the number of settings rows.
     */
    const countSettingsTwice = async () => 2 * (await testDatabase.settings.count());
    const { result, rerender } = renderHook(({ runQuery }) => useLiveQueryResult(runQuery, -1), {
      initialProps: { runQuery: countSettings },
    });
    await waitFor(() => {
      expect(result.current.value).toBe(1);
    });

    rerender({ runQuery: countSettingsTwice });

    expect(result.current).toEqual({ value: -1, error: undefined, isLoaded: false });
    await waitFor(() => {
      expect(result.current).toEqual({ value: 2, error: undefined, isLoaded: true });
    });
  });

  it('does not carry an earlier query’s value over to a new query that fails', async () => {
    const queryError = new Error('folder is gone');
    /**
     * A query that always fails.
     * @returns A rejected promise.
     */
    const failingQuery = () => Promise.reject(queryError);
    const { result, rerender } = renderHook(
      ({ runQuery }) => useLiveQueryResult<number>(runQuery, -1),
      { initialProps: { runQuery: countSettings } },
    );
    await waitFor(() => {
      expect(result.current.value).toBe(0);
    });

    rerender({ runQuery: failingQuery });

    await waitFor(() => {
      expect(result.current).toEqual({ value: -1, error: queryError, isLoaded: true });
    });
  });

  it('stops listening when unmounted', async () => {
    const { result, unmount } = renderHook(() => useLiveQueryResult(countSettings, -1));
    await waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    unmount();
    await testDatabase.settings.put({ key: 'after-unmount', value: true });

    expect(result.current.value).toBe(0);
  });
});
