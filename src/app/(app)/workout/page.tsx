"use client";

import { ChevronDown, ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { ExerciseCard } from "@/components/ExerciseCard";
import { ExercisePicker } from "@/components/ExercisePicker";
import { RestTimer } from "@/components/RestTimer";
import { Spinner } from "@/components/Spinner";
import { OverflowMenu, PageHeader } from "@/components/ui";
import { useWorkout } from "@/components/WorkoutProvider";
import { alertDialog, confirmDialog, errorDialog } from "@/lib/dialog";
import { formatClock } from "@/lib/format";
import { deleteRoutine, useRoutines } from "@/lib/routines";
import { workoutPath } from "@/lib/social";
import type { Routine } from "@/lib/types";

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
  async function onDelete() {
    if (
      !(await confirmDialog({
        title: `Delete "${routine.name}"?`,
        message: "Workouts you've already logged from it are kept.",
        confirmLabel: "Delete",
        destructive: true,
      }))
    )
      return;
    deleteRoutine(uid, routine.id).catch((e) => errorDialog("Couldn't delete routine", e));
  }

  return (
    <section className="rounded-2xl bg-surface p-4">
      <div className="flex items-start gap-2">
        <h3 className="flex-1 text-xl font-semibold">{routine.name}</h3>
        <OverflowMenu label="Routine options">
          {(close) => (
            <>
              <Link href={`/routines/${routine.id}`} className="block px-4 py-3">
                Edit routine
              </Link>
              <button
                onClick={() => {
                  close();
                  void onDelete();
                }}
                className="w-full px-4 py-3 text-left text-red-400"
              >
                Delete routine
              </button>
            </>
          )}
        </OverflowMenu>
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

  async function onFinish() {
    const sets = draft!.exercises.flatMap((e) => e.sets);
    if (!sets.some((s) => s.done)) {
      await alertDialog({
        title: "No completed sets",
        message: "Tap the check mark on at least one set before finishing.",
      });
      return;
    }
    if (
      sets.some((s) => !s.done) &&
      !(await confirmDialog({
        title: "Finish workout?",
        message: "Unchecked sets won't be saved.",
        confirmLabel: "Finish",
      }))
    ) {
      return;
    }
    const id = finish();
    if (id) router.push(workoutPath(profile.uid, id));
  }

  async function onDiscard() {
    const ok = await confirmDialog({
      title: "Discard workout?",
      message: "This can't be undone.",
      confirmLabel: "Discard",
      destructive: true,
    });
    if (ok) discard();
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
      {/* Room to scroll the last set above the floating rest timer. */}
      {draft.restEndsAt != null && <div aria-hidden className="h-20" />}
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
