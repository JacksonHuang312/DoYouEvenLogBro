"use client";

import { useState } from "react";
import type { DraftExercise } from "@/lib/draft";
import { progressionHint, rangeOf, repRangeProblem, stepKgFor, type RepRange } from "@/lib/game/progression";
import type { Unit } from "@/lib/types";
import { NumberCell } from "./NumberCell";

/**
 * An exercise's target rep range and the hint from last session (GAME_DESIGN.md 9.2), with a small
 * editor. Read-only next to the sets: it never changes what is logged. A changed range is saved to
 * the routine the workout started from; without one it lasts for this workout only.
 */
export function RepTarget({
  exercise: ex,
  unit,
  savesToRoutine,
  onSave,
}: {
  exercise: DraftExercise;
  unit: Unit;
  savesToRoutine: boolean;
  onSave: (range: RepRange | null) => void;
}) {
  const range = rangeOf(ex);
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);

  const hint = progressionHint({ range, previous: ex.previous, stepKg: stepKgFor(unit, ex.stepKg), unit });
  const problem = repRangeProblem(min, max);

  function openEditor() {
    setMin(range?.repMin ?? null);
    setMax(range?.repMax ?? null);
    setOpen(true);
  }

  function save() {
    if (problem) return;
    onSave(min != null && max != null ? { repMin: min, repMax: max } : null);
    setOpen(false);
  }

  if (open) {
    return (
      <div className="mb-3 rounded-lg bg-surface-2/50 p-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">Target reps</span>
          <div className="w-14">
            <NumberCell label={`Minimum reps for ${ex.name}`} placeholder="min" value={min} onChange={setMin} className="min-h-11" />
          </div>
          <span className="text-muted">to</span>
          <div className="w-14">
            <NumberCell label={`Maximum reps for ${ex.name}`} placeholder="max" value={max} onChange={setMax} className="min-h-11" />
          </div>
        </div>
        {problem && (
          <p role="alert" className="mt-2 text-red-400">
            {problem}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          {savesToRoutine
            ? "Saved to your routine for next time. Leave both empty to clear it."
            : "This workout didn't start from a routine, so it only lasts for this workout. Leave both empty to clear it."}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={save}
            disabled={!!problem}
            className="min-h-11 flex-1 rounded-lg bg-accent px-3 font-medium text-on-accent disabled:opacity-40"
          >
            Save
          </button>
          <button onClick={() => setOpen(false)} className="min-h-11 flex-1 rounded-lg bg-surface-2 px-3">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 text-sm">
      {range ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">
            Target{" "}
            <span className="font-medium text-white">
              {range.repMin}–{range.repMax}
            </span>{" "}
            reps
          </span>
          <button aria-label={`Edit target reps for ${ex.name}`} onClick={openEditor} className="min-h-11 rounded-lg px-3 text-accent">
            Edit
          </button>
        </div>
      ) : (
        <button aria-label={`Set target reps for ${ex.name}`} onClick={openEditor} className="min-h-11 rounded-lg text-accent">
          Set target reps
        </button>
      )}
      {hint && (
        <p data-hint={hint.kind} className="text-muted">
          {hint.text}
        </p>
      )}
    </div>
  );
}
