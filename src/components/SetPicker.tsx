"use client";

import { useEffect, useRef } from "react";
import { SET_TYPES } from "@/lib/draft";
import { effortOption, RPE_OPTIONS, type EffortScale } from "@/lib/effort";
import type { SetType } from "@/lib/types";

const TYPE_LABEL: Record<SetType, string> = { normal: "Normal", warmup: "Warm-up", drop: "Drop", failure: "Failure" };

/**
 * The sheet that opens from a set's number: its type and, optionally, how hard it was (RPE or
 * reps in reserve, per Settings). Changes apply at once; Done closes it. A bottom sheet on phones
 * and a centered dialog on desktop, like the rest picker.
 */
export function SetPicker({
  open,
  title,
  exerciseName,
  type,
  rpe,
  scale,
  onType,
  onRpe,
  onClose,
}: {
  open: boolean;
  /** "Set 2", "Warm-up set". */
  title: string;
  exerciseName: string;
  type: SetType;
  rpe: number | null;
  scale: EffortScale;
  onType: (type: SetType) => void;
  onRpe: (rpe: number | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const chip = (selected: boolean) =>
    `min-h-11 rounded-xl text-callout font-semibold tabular-nums ${selected ? "bg-accent text-on-accent" : "bg-surface-2"}`;

  return (
    <dialog
      ref={ref}
      aria-labelledby="set-picker-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Tap on the dimmed backdrop (outside the sheet) closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="mb-0 mt-auto w-full max-w-none rounded-t-2xl bg-surface p-0 text-white backdrop:bg-black/70 lg:m-auto lg:max-w-sm lg:rounded-2xl"
    >
      {open && (
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-surface-2 lg:hidden" />
          <h2 id="set-picker-title" className="text-center text-headline">
            {title}
          </h2>
          <p className="mb-4 truncate text-center text-subhead text-muted">{exerciseName}</p>

          <h3 className="mb-2 text-footnote text-muted">Type</h3>
          <div role="group" aria-label="Set type" className="grid grid-cols-4 gap-2">
            {SET_TYPES.map((t) => (
              <button key={t} type="button" aria-pressed={t === type} onClick={() => onType(t)} className={chip(t === type)}>
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <h3 className="mb-2 mt-4 text-footnote text-muted">
            {scale === "rir" ? "Reps in reserve" : "RPE"} <span className="text-muted/70">(optional)</span>
          </h3>
          <div role="group" aria-label={scale === "rir" ? "Reps in reserve" : "RPE"} className="grid grid-cols-6 gap-2">
            <button type="button" aria-pressed={rpe == null} aria-label="None" onClick={() => onRpe(null)} className={chip(rpe == null)}>
              –
            </button>
            {RPE_OPTIONS.map((value) => (
              <button key={value} type="button" aria-pressed={value === rpe} onClick={() => onRpe(value)} className={chip(value === rpe)}>
                {effortOption(value, scale)}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-footnote text-muted">
            {scale === "rir" ? "How many more reps you had left. " : "10 is all you had. "}For your log only; it doesn&apos;t change stats.
          </p>

          <button type="button" onClick={onClose} className="mt-3 w-full rounded-xl bg-surface-2 py-3 text-headline">
            Done
          </button>
        </div>
      )}
    </dialog>
  );
}
