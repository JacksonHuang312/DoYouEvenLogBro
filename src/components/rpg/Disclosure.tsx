"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState } from "react";

/** A section that folds away: a heading row (44px+ tap target) and a short summary on the right. */
export function Disclosure({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <section className="border-b border-rpg-line">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panel}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-5 text-left"
      >
        <h2 className="font-rpg-head text-xl font-semibold uppercase">{title}</h2>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-rpg-muted">
          <span className="truncate">{summary}</span>
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
        </span>
      </button>
      {open && (
        <div id={panel} className="flex flex-col gap-3 px-5 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}

/** Shown in place of live controls when there is no connection. */
export function OfflineNote({ what }: { what: string }) {
  return (
    <p role="status" className="text-xs text-rpg-warn">
      You&apos;re offline. {what} need a connection.
    </p>
  );
}
