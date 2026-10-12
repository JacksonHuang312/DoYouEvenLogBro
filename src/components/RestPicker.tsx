"use client";

import { Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { REST_OPTIONS } from "@/lib/draft";
import { formatClock } from "@/lib/format";

const label = (sec: number) => (sec === 0 ? "Off" : formatClock(sec * 1000));

/**
 * "⏱ Rest: 1:30" pill that opens a picker of rest times. A bottom sheet on phones and a
 * centered dialog on desktop; a native <dialog> handles focus, Escape and blocking the page.
 */
export function RestPicker({
  value,
  onChange,
  exerciseName,
}: {
  value: number;
  onChange: (sec: number) => void;
  exerciseName: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const on = value > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-footnote font-medium ${
          on ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted"
        }`}
      >
        <Timer size={15} />
        Rest: {label(value)}
      </button>

      <dialog
        ref={ref}
        aria-labelledby="rest-title"
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        // Tap on the dimmed backdrop (outside the sheet) closes it.
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="mb-0 mt-auto w-full max-w-none rounded-t-2xl bg-surface p-0 text-white backdrop:bg-black/70 lg:m-auto lg:max-w-sm lg:rounded-2xl"
      >
        {open && (
          <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {/* Grab handle: reads as a bottom sheet on phones. */}
            <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-surface-2 lg:hidden" />
            <h2 id="rest-title" className="text-center text-headline">
              Rest timer
            </h2>
            <p className="mb-4 truncate text-center text-subhead text-muted">{exerciseName}</p>

            <div className="grid grid-cols-5 gap-2">
              {REST_OPTIONS.map((sec) => {
                const selected = sec === value;
                return (
                  <button
                    key={sec}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      onChange(sec);
                      setOpen(false);
                    }}
                    className={`rounded-xl py-3 text-callout font-semibold tabular-nums ${
                      selected ? "bg-accent text-on-accent" : "bg-surface-2"
                    }`}
                  >
                    {label(sec)}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-center text-footnote text-muted">
              Starts counting down when you check off a set.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full rounded-xl bg-surface-2 py-3 text-headline"
            >
              Done
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
