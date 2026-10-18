"use client";

import { useEffect, useRef } from "react";
import { closeCurrentRpgDialog, useCurrentRpgDialog } from "@/lib/rpgDialog";

/**
 * Renders the RPG-look alert/confirm dialogs (section 7.1): a flat square card on a dimmed
 * backdrop. A native <dialog> opened with showModal() traps focus, blocks the page behind it and
 * handles Escape. Mounted once in the root layout, next to the old DialogHost.
 */
export function RpgDialogHost() {
  const request = useCurrentRpgDialog();
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
      aria-labelledby="rpg-dialog-title"
      aria-describedby={request?.message ? "rpg-dialog-message" : undefined}
      // Escape: treat as cancel, so the queue stays the source of truth.
      onCancel={(e) => {
        e.preventDefault();
        closeCurrentRpgDialog(false);
      }}
      // A tap on the dimmed backdrop (the dialog element itself, outside the card) cancels.
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCurrentRpgDialog(false);
      }}
      className="m-auto w-[calc(100%-2.5rem)] max-w-sm border border-rpg-line bg-rpg-surface p-0 font-rpg-body text-rpg-text backdrop:bg-rpg-bg/85"
    >
      {request && (
        <div className="flex flex-col gap-3 p-5">
          <h2 id="rpg-dialog-title" className="font-rpg-head text-2xl font-semibold uppercase leading-tight">
            {request.title}
          </h2>
          {request.message && (
            <p id="rpg-dialog-message" className="break-words text-[13px] leading-relaxed text-rpg-muted">
              {request.message}
            </p>
          )}
          <div className={`mt-1 grid gap-2 ${hasCancel ? "grid-cols-2" : ""}`}>
            {hasCancel && (
              <button
                onClick={() => closeCurrentRpgDialog(false)}
                // Destructive dialogs focus Cancel, so Enter never discards by accident.
                autoFocus={request.destructive}
                className="min-h-11 border border-rpg-line-strong px-3 text-[13px] text-rpg-text-2 outline-none focus-visible:border-rpg-accent"
              >
                {request.cancelLabel ?? "Cancel"}
              </button>
            )}
            <button
              onClick={() => closeCurrentRpgDialog(true)}
              autoFocus={!request.destructive}
              className="min-h-11 border border-rpg-text bg-rpg-text px-3 text-[13px] font-semibold text-rpg-bg outline-none focus-visible:border-rpg-accent"
            >
              {request.confirmLabel ?? "OK"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
