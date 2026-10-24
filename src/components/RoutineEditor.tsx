"use client";

import { Minus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { errorDialog } from "@/lib/dialog";
import { DEFAULT_REST_SEC } from "@/lib/draft";
import { rangeOf, repRangeProblem, stepKgFor, withRepRange } from "@/lib/game/progression";
import { PROGRESSION } from "@/lib/game/config";
import { saveRoutine } from "@/lib/routines";
import { formatNumber, kgTo, toKg } from "@/lib/units";
import type { Routine, RoutineExercise } from "@/lib/types";
import { ExercisePicker } from "./ExercisePicker";
import { RestPicker } from "./RestPicker";
import { NumberCell } from "./NumberCell";
import { ExerciseThumb } from "./ui";

const MAX_SETS = 20;

export function RoutineEditor({ uid, initial, isNew }: { uid: string; initial: Routine; isNew: boolean }) {
  const router = useRouter();
  const { unit } = useProfile();
  const [name, setName] = useState(initial.name);
  const [exercises, setExercises] = useState<RoutineExercise[]>(initial.exercises);
  const [picking, setPicking] = useState(false);

  const problems = exercises.map((e) => repRangeProblem(e.repMin, e.repMax));
  const canSave = name.trim().length > 0 && exercises.length > 0 && problems.every((p) => p == null);
  const patch = (i: number, p: Partial<RoutineExercise>) =>
    setExercises((list) => list.map((e, j) => (j === i ? { ...e, ...p } : e)));

  function onSave() {
    if (!canSave) return;
    // Not awaited: the routines listener shows it immediately, even offline.
    saveRoutine(uid, { ...initial, name: name.trim().slice(0, 100), exercises }).catch((e: Error) =>
      errorDialog("Couldn't save routine", e),
    );
    router.push("/workout");
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between bg-canvas px-4 py-3">
        <button onClick={() => router.back()} className="text-accent">
          Cancel
        </button>
        <h1 className="font-semibold">{isNew ? "Create Routine" : "Edit Routine"}</h1>
        <button
          onClick={onSave}
          disabled={!canSave}
          className="rounded-lg bg-accent text-on-accent px-4 py-1.5 font-medium disabled:opacity-40"
        >
          Save
        </button>
      </div>

      <input
        aria-label="Routine title"
        placeholder="Routine title"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        className="mb-6 w-full border-b border-line bg-transparent pb-3 text-2xl font-semibold outline-none placeholder:text-muted/60"
      />

      <div className="space-y-4">
        {exercises.map((ex, i) => (
          <section key={`${ex.exerciseId}-${i}`} className="rounded-xl bg-surface p-4">
            <div className="flex items-center gap-3">
              <ExerciseThumb exerciseId={ex.exerciseId} size={40} />
              <h2 className="flex-1 text-lg font-semibold text-accent">{ex.name}</h2>
              <button
                aria-label={`Remove ${ex.name}`}
                onClick={() => setExercises((list) => list.filter((_, j) => j !== i))}
                className="p-1 text-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-muted">Sets</span>
                <button
                  aria-label="Fewer sets"
                  disabled={ex.sets <= 1}
                  onClick={() => patch(i, { sets: ex.sets - 1 })}
                  className="rounded-md bg-surface-2 p-1.5 disabled:opacity-30"
                >
                  <Minus size={16} />
                </button>
                <span className="w-5 text-center tabular-nums">{ex.sets}</span>
                <button
                  aria-label="More sets"
                  disabled={ex.sets >= MAX_SETS}
                  onClick={() => patch(i, { sets: ex.sets + 1 })}
                  className="rounded-md bg-surface-2 p-1.5 disabled:opacity-30"
                >
                  <Plus size={16} />
                </button>
              </div>
              <RestPicker
                value={ex.restSec}
                exerciseName={ex.name}
                onChange={(sec) => patch(i, { restSec: sec })}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-muted">Target reps</span>
              <div className="flex items-center gap-2">
                <div className="w-14">
                  <NumberCell
                    className="min-h-11"
                    label={`Minimum reps for ${ex.name}`}
                    placeholder="min"
                    value={ex.repMin ?? null}
                    onChange={(n) => setExercises((list) => list.map((e, j) => (j === i ? withRepRange(e, { repMin: n }) : e)))}
                  />
                </div>
                <span className="text-muted">to</span>
                <div className="w-14">
                  <NumberCell
                    className="min-h-11"
                    label={`Maximum reps for ${ex.name}`}
                    placeholder="max"
                    value={ex.repMax ?? null}
                    onChange={(n) => setExercises((list) => list.map((e, j) => (j === i ? withRepRange(e, { repMax: n }) : e)))}
                  />
                </div>
              </div>
              {rangeOf(ex) && (
                <div className="flex items-center gap-2">
                  <span className="text-muted">Add</span>
                  <div className="w-16">
                    <NumberCell
                      className="min-h-11"
                      decimal
                      label={`Weight step for ${ex.name}`}
                      placeholder={formatNumber(PROGRESSION.defaultStep[unit])}
                      value={ex.stepKg == null ? null : Math.round(kgTo(unit, ex.stepKg) * 100) / 100}
                      onChange={(n) =>
                        setExercises((list) =>
                          list.map((e, j) => (j === i ? withRepRange(e, { stepKg: n != null && n > 0 ? toKg(unit, n) : null }) : e)),
                        )
                      }
                    />
                  </div>
                  <span className="text-muted">{unit}</span>
                </div>
              )}
            </div>
            {problems[i] && (
              <p role="alert" className="mt-2 text-sm text-red-400">
                {problems[i]}
              </p>
            )}
            {rangeOf(ex) && (
              <p className="mt-2 text-sm text-muted">
                Target {ex.repMin}-{ex.repMax} reps, adding {formatNumber(kgTo(unit, stepKgFor(unit, ex.stepKg)))} {unit} at a time.
              </p>
            )}
          </section>
        ))}
      </div>

      <button
        onClick={() => setPicking(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent text-on-accent py-3 font-semibold"
      >
        <Plus size={20} /> Add Exercise
      </button>

      {picking && (
        <ExercisePicker
          uid={uid}
          onClose={() => setPicking(false)}
          onAdd={(list) => {
            setExercises((cur) => [
              ...cur,
              ...list.map((e) => ({ exerciseId: e.id, name: e.name, sets: 3, restSec: DEFAULT_REST_SEC })),
            ]);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
