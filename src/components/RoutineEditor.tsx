"use client";

import { Minus, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorDialog } from "@/lib/dialog";
import { DEFAULT_REST_SEC } from "@/lib/draft";
import { formatClock } from "@/lib/format";
import { saveRoutine } from "@/lib/routines";
import type { Routine, RoutineExercise } from "@/lib/types";
import { ExercisePicker } from "./ExercisePicker";
import { ExerciseThumb } from "./ui";

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
const MAX_SETS = 20;

export function RoutineEditor({ uid, initial, isNew }: { uid: string; initial: Routine; isNew: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [exercises, setExercises] = useState<RoutineExercise[]>(initial.exercises);
  const [picking, setPicking] = useState(false);

  const canSave = name.trim().length > 0 && exercises.length > 0;
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
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between bg-black px-4 py-3">
        <button onClick={() => router.back()} className="text-accent">
          Cancel
        </button>
        <h1 className="font-semibold">{isNew ? "Create Routine" : "Edit Routine"}</h1>
        <button
          onClick={onSave}
          disabled={!canSave}
          className="rounded-lg bg-accent px-4 py-1.5 font-medium disabled:opacity-40"
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
              <label className="flex items-center gap-2 text-muted">
                Rest
                <select
                  value={ex.restSec}
                  onChange={(e) => patch(i, { restSec: Number(e.target.value) })}
                  className="rounded-md bg-surface-2 px-2 py-1 text-white"
                >
                  {REST_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s === 0 ? "Off" : formatClock(s * 1000)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        ))}
      </div>

      <button
        onClick={() => setPicking(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold"
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
