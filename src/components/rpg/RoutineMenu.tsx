"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** The "⋯" on a routine row: Edit and Delete, in the RPG look. Closes on any outside tap or Escape. */
export function RoutineMenu({ routineId, name, onDelete }: { routineId: string; name: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const row = "flex min-h-11 w-full items-center px-4 text-left text-sm hover:bg-rpg-line-soft";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Options for ${name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 w-11 items-center justify-center text-rpg-muted"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <>
          <div aria-hidden className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-11 z-40 w-44 border border-rpg-line-strong bg-rpg-surface py-1">
            <Link href={`/routines/${routineId}`} role="menuitem" className={row}>
              Edit routine
            </Link>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className={`${row} text-rpg-bad`}
            >
              Delete routine
            </button>
          </div>
        </>
      )}
    </div>
  );
}
