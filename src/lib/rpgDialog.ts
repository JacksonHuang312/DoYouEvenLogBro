import { useSyncExternalStore } from "react";
import type { DialogOptions } from "./dialog";

/**
 * The RPG-look twin of dialog.ts, for the screens built in the section 7.1 style. It has its own
 * queue and its own host (<RpgDialogHost>), so the old dialog and the old screens that use it are
 * untouched until Phase 8 restyles them.
 */
export type RpgDialogOptions = DialogOptions;

export interface RpgDialogRequest extends RpgDialogOptions {
  resolve: (confirmed: boolean) => void;
}

let queue: RpgDialogRequest[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Resolves true if confirmed, false if cancelled (button, Escape or backdrop). */
export function confirmRpgDialog(options: RpgDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [...queue, { ...options, resolve }];
    emit();
  });
}

/** One-button message, e.g. an error. Resolves when dismissed. */
export async function alertRpgDialog(options: Omit<RpgDialogOptions, "cancelLabel" | "destructive">): Promise<void> {
  await confirmRpgDialog({ ...options, cancelLabel: null });
}

/** Shorthand for a failed action: the title plus the error message. */
export function errorRpgDialog(title: string, err: unknown) {
  return alertRpgDialog({ title, message: err instanceof Error ? err.message : String(err) });
}

export function closeCurrentRpgDialog(confirmed: boolean) {
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
export function useCurrentRpgDialog(): RpgDialogRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => queue[0] ?? null,
    () => null,
  );
}
