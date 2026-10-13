import { Dexie } from 'dexie';
import { useEffect, useState } from 'react';

/** The latest result of a live query, plus whether it has loaded and any error. */
export interface LiveQueryState<QueryResult> {
  value: QueryResult;
  error: unknown;
  isLoaded: boolean;
}

/** The stored result, remembering which query produced it. */
interface StoredQueryResult<QueryResult> {
  /** The latest successful answer, wrapped so "no answer yet" is distinct from any value. */
  latestAnswer: { value: QueryResult } | undefined;
  error: unknown;
  isLoaded: boolean;
  producedByQuery: () => Promise<QueryResult>;
}

/**
 * Runs a database query and runs it again after every committed database write (in this tab or
 * another tab), so components always show the current filesystem. Pass a query memoized with
 * `useCallback`; a new query function restarts the subscription, and until the new query has
 * answered the initial value is shown again (so a Finder window that moves to another folder never
 * shows the previous folder's items).
 *
 * Why not Dexie's `liveQuery`: it re-runs only when data it saw being read changes, and that
 * tracking was lost through the filesystem service's many nested `await`s (Phase 1 E2E: new folders
 * never appeared). Re-running after any write is simpler and always correct; the desktop's data is
 * small, so the extra queries are cheap. A failed run keeps the previous value, and the next write
 * runs the query again, so a brief failure (for example during "Reset Desktop") recovers by itself.
 * @param runQuery - The query to run, for example listing the Desktop folder.
 * @param initialValue - Value to show until the first result arrives.
 * @returns The latest value (kept through errors), the latest error, and whether a run has finished.
 */
export function useLiveQueryResult<QueryResult>(
  runQuery: () => Promise<QueryResult>,
  initialValue: QueryResult,
): LiveQueryState<QueryResult> {
  const [storedResult, setStoredResult] = useState<StoredQueryResult<QueryResult>>({
    latestAnswer: undefined,
    error: undefined,
    isLoaded: false,
    producedByQuery: runQuery,
  });

  useEffect(() => {
    let isStillSubscribed = true;
    let newestRunNumber = 0;

    /**
     * Runs the query and stores its result, unless a newer run has started since.
     */
    function runQueryAndStoreResult(): void {
      newestRunNumber += 1;
      const thisRunNumber = newestRunNumber;
      /**
       * Reports whether this run's result should still be shown.
       * @returns True when the component is mounted and no newer run has started.
       */
      const isNewestRun = (): boolean => isStillSubscribed && thisRunNumber === newestRunNumber;
      runQuery().then(
        (latestValue) => {
          if (isNewestRun()) {
            setStoredResult({
              latestAnswer: { value: latestValue },
              error: undefined,
              isLoaded: true,
              producedByQuery: runQuery,
            });
          }
        },
        (queryError: unknown) => {
          if (isNewestRun()) {
            setStoredResult((previousResult) => ({
              latestAnswer:
                previousResult.producedByQuery === runQuery
                  ? previousResult.latestAnswer
                  : undefined,
              error: queryError,
              isLoaded: true,
              producedByQuery: runQuery,
            }));
          }
        },
      );
    }

    runQueryAndStoreResult();
    Dexie.on.storagemutated.subscribe(runQueryAndStoreResult);
    return () => {
      isStillSubscribed = false;
      Dexie.on.storagemutated.unsubscribe(runQueryAndStoreResult);
    };
  }, [runQuery]);

  const isResultFromCurrentQuery = storedResult.producedByQuery === runQuery;
  if (!isResultFromCurrentQuery) {
    return { value: initialValue, error: undefined, isLoaded: false };
  }
  return {
    value: storedResult.latestAnswer === undefined ? initialValue : storedResult.latestAnswer.value,
    error: storedResult.error,
    isLoaded: storedResult.isLoaded,
  };
}
