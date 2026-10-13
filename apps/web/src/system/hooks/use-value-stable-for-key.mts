import { useState } from 'react';

/**
 * Keeps returning the first value seen for a key until the key changes. Live queries hand back a
 * fresh copy of a file (new bytes object) after every database write, even unrelated ones such as
 * a window moving; previews use this so they only redraw when the file itself changes.
 * @param value - The latest value.
 * @param stabilityKey - Changes exactly when the value really changes (for example a file's id,
 *   modification time and size).
 * @returns The value first seen for the current key.
 */
export function useValueStableForKey<Value>(value: Value, stabilityKey: string): Value {
  const [stableEntry, setStableEntry] = useState({ stabilityKey, value });
  if (stableEntry.stabilityKey !== stabilityKey) {
    // Adjusting state while rendering (instead of in an effect) is React's documented way to
    // follow a changed input without showing the stale value for a frame.
    setStableEntry({ stabilityKey, value });
    return value;
  }
  return stableEntry.value;
}
