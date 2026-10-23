"use client";

import { useCallback, useRef, useState } from "react";
import { errorRpgDialog } from "./rpgDialog";

/**
 * Runs one server action at a time for a panel: a second tap while one is in flight is ignored
 * (the ref answers before React re-renders), `busy` turns the buttons off, and a failure opens
 * the error dialog. Returns the result, or undefined if it was skipped or failed.
 */
export function useRunner() {
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);

  const run = useCallback(async <T,>(title: string, action: () => Promise<T>): Promise<T | undefined> => {
    if (flight.current) return undefined;
    flight.current = true;
    setBusy(true);
    try {
      return await action();
    } catch (err) {
      void errorRpgDialog(title, err);
      return undefined;
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
