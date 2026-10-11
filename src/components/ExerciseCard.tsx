"use client";

import { ArrowDown, ArrowUp, Check, Plus, X } from "lucide-react";
import { confirmDialog } from "@/lib/dialog";
import * as Draft from "@/lib/draft";
import type { DraftExercise } from "@/lib/draft";
import { formatClock } from "@/lib/format";
import type { SetType, Unit } from "@/lib/types";
import { formatNumber, kgTo, toKg } from "@/lib/units";
import { NumberCell } from "./NumberCell";
import { ExerciseThumb } from "./ui";
import { useWorkout } from "./WorkoutProvider";

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

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

/** One exercise in the active workout: header, rest timer setting and the set rows. */
export function ExerciseCard({
  exercise: ex,
  unit,
  isFirst,
  isLast,
}: {
  exercise: DraftExercise;
  unit: Unit;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { update } = useWorkout();
  const labels = Draft.setLabels(ex.sets);
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

      <label className="mb-3 flex items-center gap-2 text-sm text-muted">
        Rest timer
        <select
          value={ex.restSec}
          onChange={(e) => update((w) => Draft.setRest(w, ex.key, Number(e.target.value)))}
          className="rounded-md bg-surface-2 px-2 py-1 text-white"
        >
          {REST_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 0 ? "Off" : formatClock(s * 1000)}
            </option>
          ))}
        </select>
      </label>

      <div className={GRID}>
        <span className="text-center text-xs text-muted">SET</span>
        <span className="text-xs text-muted max-[359px]:hidden">PREVIOUS</span>
        <span className="text-center text-xs text-muted">{unit === "lb" ? "LBS" : "KG"}</span>
        <span className="text-center text-xs text-muted">REPS</span>
        <span className="flex justify-center text-muted">
          <Check size={14} />
        </span>
        <span />

        {ex.sets.map((set, i) => {
          const prev = ex.previous?.[i];
          const prevWeight = prev?.weightKg != null ? formatNumber(kgTo(unit, prev.weightKg)) : undefined;
          return (
            <div key={set.key} className="contents">
              <button
                aria-label={`Set ${labels[i]}, ${set.type}. Tap to change type`}
                onClick={() => update((w) => Draft.cycleSetType(w, ex.key, set.key))}
                className={`h-10 rounded-md font-semibold ${SET_TYPE_STYLE[set.type]}`}
              >
                {labels[i]}
              </button>
              <span className="truncate text-sm text-muted max-[359px]:hidden">
                {prev ? `${prevWeight ?? "BW"} × ${prev.reps}` : "-"}
              </span>
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
              <button
                aria-label={set.done ? "Mark set not done" : "Mark set done"}
                aria-pressed={set.done}
                onClick={() => update((w) => Draft.toggleDone(w, ex.key, set.key))}
                className={`flex h-10 items-center justify-center rounded-md ${
                  set.done ? "bg-green-600 text-white" : "bg-surface-2 text-muted"
                }`}
              >
                <Check size={18} strokeWidth={3} />
              </button>
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
}
