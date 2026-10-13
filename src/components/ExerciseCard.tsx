"use client";

import { ArrowDown, ArrowUp, Check, Plus, Trophy, X } from "lucide-react";
import { memo } from "react";
import { confirmDialog } from "@/lib/dialog";
import * as Draft from "@/lib/draft";
import type { DraftExercise } from "@/lib/draft";
import type { SetType, Unit } from "@/lib/types";
import { findRecords } from "@/lib/records";
import { formatNumber, kgTo, toKg } from "@/lib/units";
import { NumberCell } from "./NumberCell";
import { RestPicker } from "./RestPicker";
import { ExerciseThumb } from "./ui";

const SET_TYPE_STYLE: Record<SetType, string> = {
  normal: "bg-surface-2 text-white",
  warmup: "bg-amber-500/20 text-amber-400",
  drop: "bg-purple-500/20 text-purple-400",
  failure: "bg-red-500/20 text-red-400",
};

// Set | Previous | Weight | Reps | ✓ | delete. Fits a 360px phone; below that the
// Previous column is hidden (its values still show as input placeholders).
const GRID =
  "grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_3.25rem_2.5rem_1.75rem] max-[359px]:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem_2rem] items-center gap-x-1.5 gap-y-2";
// Editing a saved workout: Set | Weight | Reps | delete (no Previous column or check marks).
const EDIT_GRID = "grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem] items-center gap-x-1.5 gap-y-2";

/**
 * One exercise in a workout draft: header, rest timer setting and the set rows. `update` applies
 * a change to the draft it belongs to. With `editing` (a saved workout) every set counts, so the
 * rest timer, Previous column and check marks are hidden.
 *
 * Memoized: an edit only changes that exercise's object, so the other cards skip re-rendering
 * on every keystroke (`update` must be stable, e.g. from useCallback).
 */
export const ExerciseCard = memo(function ExerciseCard({
  exercise: ex,
  unit,
  isFirst,
  isLast,
  update,
  editing = false,
}: {
  exercise: DraftExercise;
  unit: Unit;
  isFirst: boolean;
  isLast: boolean;
  update: (fn: (w: Draft.DraftWorkout) => Draft.DraftWorkout) => void;
  editing?: boolean;
}) {
  const labels = Draft.setLabels(ex.sets);
  // Trophies on record sets: while logging only once checked off; when editing, every set counts.
  const records = findRecords(
    ex.sets.map((s) => (editing || s.done ? s : { ...s, reps: null })),
    ex.bests,
  );
  const iconBtn = "rounded-lg p-2 text-muted active:bg-surface-2 disabled:opacity-30";

  async function onRemove() {
    const ok = await confirmDialog({
      title: `Remove ${ex.name}?`,
      message: "Its sets in this workout will be removed too.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (ok) update((w) => Draft.removeExercise(w, ex.key));
  }

  return (
    <section className="rounded-xl bg-surface p-3">
      <div className="mb-2 flex items-center gap-1">
        <ExerciseThumb exerciseId={ex.exerciseId} size={40} />
        <h2 className="ml-2 min-w-0 flex-1 truncate text-lg font-semibold text-accent">{ex.name}</h2>
        <button aria-label="Move up" disabled={isFirst} className={iconBtn} onClick={() => update((w) => Draft.moveExercise(w, ex.key, -1))}>
          <ArrowUp size={18} />
        </button>
        <button aria-label="Move down" disabled={isLast} className={iconBtn} onClick={() => update((w) => Draft.moveExercise(w, ex.key, 1))}>
          <ArrowDown size={18} />
        </button>
        <button aria-label="Remove exercise" className={iconBtn} onClick={onRemove}>
          <X size={18} />
        </button>
      </div>

      {!editing && (
        <div className="mb-3">
          <RestPicker
            value={ex.restSec}
            exerciseName={ex.name}
            onChange={(sec) => update((w) => Draft.setRest(w, ex.key, sec))}
          />
        </div>
      )}

      <div className={editing ? EDIT_GRID : GRID}>
        <span className="text-center text-xs text-muted">SET</span>
        {!editing && <span className="text-xs text-muted max-[359px]:hidden">PREVIOUS</span>}
        <span className="text-center text-xs text-muted">{unit === "lb" ? "LBS" : "KG"}</span>
        <span className="text-center text-xs text-muted">REPS</span>
        {!editing && (
          <span className="flex justify-center text-muted">
            <Check size={14} />
          </span>
        )}
        <span />

        {ex.sets.map((set, i) => {
          const prev = ex.previous?.[i];
          const prevWeight = prev?.weightKg != null ? formatNumber(kgTo(unit, prev.weightKg)) : undefined;
          return (
            <div key={set.key} className="contents">
              <button
                aria-label={`Set ${labels[i]}, ${set.type}${records[i] ? ", personal record" : ""}. Tap to change type`}
                onClick={() => update((w) => Draft.cycleSetType(w, ex.key, set.key))}
                className={`relative h-10 rounded-md font-semibold ${SET_TYPE_STYLE[set.type]}`}
              >
                {labels[i]}
                {records[i] && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-black">
                    <Trophy size={11} strokeWidth={2.5} />
                  </span>
                )}
              </button>
              {!editing && (
                <span className="truncate text-sm text-muted max-[359px]:hidden">
                  {prev ? `${prevWeight ?? "BW"} × ${prev.reps}` : "-"}
                </span>
              )}
              <NumberCell
                key={unit}
                label="Weight"
                decimal
                value={set.weightKg == null ? null : kgTo(unit, set.weightKg)}
                placeholder={prevWeight}
                onChange={(v) =>
                  update((w) => Draft.updateSet(w, ex.key, set.key, { weightKg: v == null ? null : toKg(unit, v) }))
                }
                className="h-10"
              />
              <NumberCell
                label="Reps"
                value={set.reps}
                placeholder={prev ? String(prev.reps) : undefined}
                onChange={(v) => update((w) => Draft.updateSet(w, ex.key, set.key, { reps: v }))}
                className="h-10"
              />
              {!editing && (
                <button
                  aria-label={set.done ? "Mark set not done" : "Mark set done"}
                  aria-pressed={set.done}
                  onClick={() => update((w) => Draft.toggleDone(w, ex.key, set.key))}
                  className={`flex h-10 items-center justify-center rounded-md ${
                    set.done ? "bg-accent text-on-accent" : "bg-surface-2 text-muted"
                  }`}
                >
                  <Check size={18} strokeWidth={3} />
                </button>
              )}
              <button
                aria-label="Delete set"
                onClick={() => update((w) => Draft.removeSet(w, ex.key, set.key))}
                className="flex h-10 items-center justify-center rounded-md text-muted/60 active:text-red-400"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => update((w) => Draft.addSet(w, ex.key))}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-2 py-2.5 text-sm font-medium"
      >
        <Plus size={16} /> Add Set
      </button>
    </section>
  );
});
