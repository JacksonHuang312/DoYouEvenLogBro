"use client";

import { ChevronDown, ClipboardList, MoreHorizontal, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { ExercisePicker } from "@/components/ExercisePicker";
import { NumberCell } from "@/components/NumberCell";
import { RestTimer } from "@/components/RestTimer";
import { Spinner } from "@/components/Spinner";
import { ExerciseThumb, PageHeader } from "@/components/ui";
import { useWorkout } from "@/components/WorkoutProvider";
import * as Draft from "@/lib/draft";
import type { DraftExercise } from "@/lib/draft";
import { formatClock } from "@/lib/format";
import { deleteRoutine, useRoutines } from "@/lib/routines";
import type { Routine, SetType, Unit } from "@/lib/types";
import { formatNumber, kgTo, toKg } from "@/lib/units";

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

const SET_TYPE_STYLE: Record<SetType, string> = {
  normal: "bg-surface-2 text-white",
  warmup: "bg-amber-500/20 text-amber-400",
  drop: "bg-purple-500/20 text-purple-400",
  failure: "bg-red-500/20 text-red-400",
};

export default function WorkoutPage() {
  const { draft } = useWorkout();
  return draft ? <ActiveWorkout /> : <WorkoutHome />;
}

function WorkoutHome() {
  const profile = useProfile();
  const { start, startRoutine } = useWorkout();
  const routines = useRoutines(profile.uid);
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <PageHeader title="Workout" />
      <button onClick={start} className="flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-3.5 text-lg">
        <Plus size={26} /> Start Empty Workout
      </button>

      <h2 className="mb-3 mt-7 text-xl font-semibold">Routines</h2>
      <Link href="/routines/new" className="flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-3.5 text-lg">
        <ClipboardList size={24} /> New Routine
      </Link>

      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="mt-6 flex items-center gap-2 text-lg text-muted"
      >
        <ChevronDown size={20} className={expanded ? "" : "-rotate-90"} />
        My Routines ({routines?.length ?? 0})
      </button>

      {expanded && (
        <div className="mt-3 space-y-4">
          {!routines && <Spinner />}
          {routines?.length === 0 && (
            <p className="py-6 text-center text-muted">Save the workouts you repeat as routines to start them in one tap.</p>
          )}
          {routines?.map((r) => (
            <RoutineCard key={r.id} routine={r} uid={profile.uid} onStart={() => startRoutine(r)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoutineCard({ routine, uid, onStart }: { routine: Routine; uid: string; onStart: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function onDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete "${routine.name}"?`)) return;
    deleteRoutine(uid, routine.id).catch((e: Error) => alert(e.message));
  }

  return (
    <section className="rounded-2xl bg-surface p-4">
      <div className="flex items-start gap-2">
        <h3 className="flex-1 text-xl font-semibold">{routine.name}</h3>
        <div className="relative">
          <button aria-label="Routine options" onClick={() => setMenuOpen((o) => !o)} className="p-1">
            <MoreHorizontal size={22} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-40 overflow-hidden rounded-xl bg-surface-2 shadow-lg">
              <Link href={`/routines/${routine.id}`} className="block px-4 py-3">
                Edit routine
              </Link>
              <button onClick={onDelete} className="w-full px-4 py-3 text-left text-red-400">
                Delete routine
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="mb-4 mt-1 line-clamp-2 text-muted">{routine.exercises.map((e) => e.name).join(", ")}</p>
      <button onClick={onStart} className="w-full rounded-xl bg-accent py-3 text-lg font-medium">
        Start Routine
      </button>
    </section>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{formatClock(now - since)}</span>;
}

function ActiveWorkout() {
  const profile = useProfile();
  const { draft, update, discard, addExercises, finish } = useWorkout();
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  if (!draft) return null;

  function onFinish() {
    const sets = draft!.exercises.flatMap((e) => e.sets);
    if (!sets.some((s) => s.done)) {
      alert("Complete at least one set first (tap the check mark).");
      return;
    }
    if (sets.some((s) => !s.done) && !confirm("Unchecked sets won't be saved. Finish workout?")) {
      return;
    }
    const id = finish();
    if (id) router.push(`/history/${id}`);
  }

  function onDiscard() {
    if (confirm("Discard this workout? This can't be undone.")) discard();
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-3 bg-black/95 px-4 py-2 backdrop-blur">
        <div className="flex-1">
          <input
            aria-label="Workout name"
            value={draft.name}
            onChange={(e) => update((w) => ({ ...w, name: e.target.value }))}
            maxLength={100}
            className="w-full bg-transparent text-lg font-semibold outline-none"
          />
          <div className="text-sm text-muted">
            <Elapsed since={draft.startedAt} />
          </div>
        </div>
        <button onClick={onFinish} className="rounded-lg bg-accent px-4 py-2 font-semibold">
          Finish
        </button>
      </div>

      {draft.exercises.map((ex, i) => (
        <ExerciseCard
          key={ex.key}
          exercise={ex}
          unit={profile.unit}
          isFirst={i === 0}
          isLast={i === draft.exercises.length - 1}
        />
      ))}

      <button
        onClick={() => setPicking(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold"
      >
        <Plus size={20} /> Add Exercise
      </button>
      <button onClick={onDiscard} className="w-full rounded-xl bg-surface py-3 font-medium text-red-400">
        Discard Workout
      </button>

      <RestTimer />
      {picking && (
        <ExercisePicker
          uid={profile.uid}
          onClose={() => setPicking(false)}
          onAdd={(list) => {
            addExercises(list);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function ExerciseCard({
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
  const iconBtn = "rounded px-2 py-1 text-muted hover:bg-surface-2 disabled:opacity-30";

  return (
    <section className="rounded-xl bg-surface p-3">
      <div className="mb-2 flex items-center gap-1">
        <ExerciseThumb exerciseId={ex.exerciseId} name={ex.name} size={40} />
        <h2 className="ml-2 flex-1 text-lg font-semibold text-accent">{ex.name}</h2>
        <button aria-label="Move up" disabled={isFirst} className={iconBtn} onClick={() => update((w) => Draft.moveExercise(w, ex.key, -1))}>
          ↑
        </button>
        <button aria-label="Move down" disabled={isLast} className={iconBtn} onClick={() => update((w) => Draft.moveExercise(w, ex.key, 1))}>
          ↓
        </button>
        <button
          aria-label="Remove exercise"
          className={iconBtn}
          onClick={() => confirm(`Remove ${ex.name}?`) && update((w) => Draft.removeExercise(w, ex.key))}
        >
          <X size={18} />
        </button>
      </div>

      <label className="mb-2 flex items-center gap-2 text-sm text-muted">
        Rest timer
        <select
          value={ex.restSec}
          onChange={(e) => update((w) => Draft.setRest(w, ex.key, Number(e.target.value)))}
          className="rounded bg-surface-2 px-2 py-1 text-white"
        >
          {REST_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 0 ? "Off" : formatClock(s * 1000)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-[2.5rem_1fr_4.5rem_4rem_2.5rem_1.5rem] items-center gap-x-2 gap-y-1.5 text-sm">
        <span className="text-center text-xs text-muted">SET</span>
        <span className="text-xs text-muted">PREVIOUS</span>
        <span className="text-center text-xs text-muted">{unit.toUpperCase()}</span>
        <span className="text-center text-xs text-muted">REPS</span>
        <span className="text-center text-xs text-muted">✓</span>
        <span />

        {ex.sets.map((set, i) => {
          const prev = ex.previous?.[i];
          const prevWeight = prev?.weightKg != null ? formatNumber(kgTo(unit, prev.weightKg)) : undefined;
          return (
            <div key={set.key} className="contents">
              <button
                title="Tap to change set type"
                onClick={() => update((w) => Draft.cycleSetType(w, ex.key, set.key))}
                className={`h-8 rounded-md font-semibold ${SET_TYPE_STYLE[set.type]}`}
              >
                {labels[i]}
              </button>
              <span className="truncate rounded-md py-1.5 text-muted">
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
              />
              <NumberCell
                label="Reps"
                value={set.reps}
                placeholder={prev ? String(prev.reps) : undefined}
                onChange={(v) => update((w) => Draft.updateSet(w, ex.key, set.key, { reps: v }))}
              />
              <button
                aria-label={set.done ? "Mark set not done" : "Mark set done"}
                onClick={() => update((w) => Draft.toggleDone(w, ex.key, set.key))}
                className={`h-8 rounded-md font-bold ${set.done ? "bg-green-600 text-white" : "bg-surface-2 text-muted"}`}
              >
                ✓
              </button>
              <button
                aria-label="Delete set"
                onClick={() => update((w) => Draft.removeSet(w, ex.key, set.key))}
                className="h-8 rounded-md text-muted/60 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => update((w) => Draft.addSet(w, ex.key))}
        className="mt-3 w-full rounded-lg bg-surface-2 py-2 text-sm font-medium"
      >
        + Add set
      </button>
    </section>
  );
}
