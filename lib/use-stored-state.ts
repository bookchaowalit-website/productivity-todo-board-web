"use client";

import { useEffect, useState } from "react";
import { readStoredState, writeStoredState } from "./stored-state";

/**
 * State mirrored to localStorage. The first render always uses `initial` so the
 * server and client markup match; the stored value is read after mount and run
 * through `parse`, which should return null for missing or invalid data.
 * Pass a stable (module-level) `parse` function.
 */
export function useStoredState<T>(key: string, initial: T, parse: (raw: string | null) => T | null) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  // True while the latest write was refused (storage full or blocked): the page can say changes are not saved.
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let stored: T | null = null;
    try {
      stored = readStoredState(window.localStorage, key, parse);
    } catch {
      stored = null;
    }
    // Hydrating from browser-only storage after mount is the intended use of this effect.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (stored !== null) setValue(stored);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [key, parse]);

  useEffect(() => {
    if (!ready) return;
    try {
      writeStoredState(window.localStorage, key, value);
      // Reporting the outcome of the browser write is this effect's job.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaveFailed(false);
    } catch {
      // Storage can be full or blocked (private mode); the in-memory state still works, but say it is not saved.
      setSaveFailed(true);
    }
  }, [key, value, ready]);

  return [value, setValue, ready, saveFailed] as const;
}
