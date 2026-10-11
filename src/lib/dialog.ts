import { useSyncExternalStore } from "react";

/**
 * In-app replacements for window.alert / window.confirm. Callable from anywhere
 * (components, promise callbacks); <DialogHost> in the root layout renders them one at a time.
 */
export interface DialogOptions {
  title: string;
  message?: string;
  /** Defaults to "OK". */
  confirmLabel?: string;
  /** Defaults to "Cancel". null hides it (alert style). */
  cancelLabel?: string | null;
  /** Red confirm button, for deletes and discards. */
  destructive?: boolean;
}

export interface DialogRequest extends DialogOptions {
  resolve: (confirmed: boolean) => void;
}

let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Resolves true if confirmed, false if cancelled (button, Escape or backdrop). */
export function confirmDialog(options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [...queue, { ...options, resolve }];
    emit();
  });
}

/** One-button message, e.g. an error. Resolves when dismissed. */
export async function alertDialog(options: Omit<DialogOptions, "cancelLabel" | "destructive">): Promise<void> {
  await confirmDialog({ ...options, cancelLabel: null });
}

/** Shorthand for a failed write: "Couldn't delete workout" + the error message. */
export function errorDialog(title: string, err: unknown) {
  return alertDialog({ title, message: err instanceof Error ? err.message : String(err) });
}

export function closeCurrentDialog(confirmed: boolean) {
  const [current, ...rest] = queue;
  if (!current) return;
  queue = rest;
  emit();
  current.resolve(confirmed);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The dialog currently on screen, if any. */
export function useCurrentDialog(): DialogRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => queue[0] ?? null,
    () => null,
  );
}
