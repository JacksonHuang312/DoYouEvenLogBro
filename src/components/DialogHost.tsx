"use client";

import { useEffect, useRef } from "react";
import { closeCurrentDialog, useCurrentDialog } from "@/lib/dialog";

/**
 * Renders the in-app alert/confirm dialogs. Uses a native <dialog> opened with
 * showModal(), which traps focus, blocks the page behind it and handles Escape.
 */
export function DialogHost() {
  const request = useCurrentDialog();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (request && !el.open) el.showModal();
    if (!request && el.open) el.close();
  }, [request]);

  const hasCancel = request?.cancelLabel !== null;

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      aria-describedby={request?.message ? "dialog-message" : undefined}
      // Escape key: treat as cancel. preventDefault so React state stays the source of truth.
      onCancel={(e) => {
        e.preventDefault();
        closeCurrentDialog(false);
      }}
      // Tap on the dimmed backdrop (the dialog element itself, outside the card) cancels.
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCurrentDialog(false);
      }}
      className="m-auto w-[calc(100%-3rem)] max-w-xs overflow-hidden rounded-2xl bg-surface p-0 text-white shadow-2xl backdrop:bg-black/70"
    >
      {request && (
        <div>
          <div className="px-5 pb-4 pt-5 text-center">
            <h2 id="dialog-title" className="text-lg font-semibold">
              {request.title}
            </h2>
            {request.message && (
              <p id="dialog-message" className="mt-1.5 text-sm text-muted">
                {request.message}
              </p>
            )}
          </div>
          <div className={`grid border-t border-line ${hasCancel ? "grid-cols-2 divide-x divide-line" : ""}`}>
            {hasCancel && (
              <button
                onClick={() => closeCurrentDialog(false)}
                // Destructive dialogs focus Cancel, so Enter never deletes by accident.
                autoFocus={request.destructive}
                className="py-3.5 text-accent outline-none focus-visible:bg-surface-2"
              >
                {request.cancelLabel ?? "Cancel"}
              </button>
            )}
            <button
              onClick={() => closeCurrentDialog(true)}
              autoFocus={!request.destructive}
              className={`py-3.5 font-semibold outline-none focus-visible:bg-surface-2 ${
                request.destructive ? "text-red-400" : "text-accent"
              }`}
            >
              {request.confirmLabel ?? "OK"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
