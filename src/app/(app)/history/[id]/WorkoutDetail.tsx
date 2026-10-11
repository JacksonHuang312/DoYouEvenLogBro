"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { Spinner } from "@/components/Spinner";
import { Avatar, ExerciseThumb } from "@/components/ui";
import { SetList, WorkoutStats } from "@/components/WorkoutSummary";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { formatDate } from "@/lib/format";
import type { Workout } from "@/lib/types";
import { deleteWorkout, getWorkout } from "@/lib/workouts";

export function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const profile = useProfile();
  const router = useRouter();
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);

  useEffect(() => {
    getWorkout(profile.uid, id)
      .then(setWorkout)
      .catch(() => setWorkout(null));
  }, [profile.uid, id]);

  if (workout === undefined) return <Spinner />;
  if (workout === null) {
    return (
      <div className="py-10 text-center text-muted">
        Workout not found.{" "}
        <Link href="/home" className="text-accent">
          Back home
        </Link>
      </div>
    );
  }

  async function onDelete() {
    const ok = await confirmDialog({
      title: "Delete workout?",
      message: "This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    deleteWorkout(profile.uid, id).catch((e) => errorDialog("Couldn't delete workout", e));
    router.replace("/home");
  }

  return (
    <div>
      <div className="-mx-4 mb-4 flex items-center px-2 py-2">
        <button onClick={() => router.back()} aria-label="Back" className="p-1 text-accent">
          <ChevronLeft size={28} />
        </button>
        <h1 className="flex-1 text-center font-semibold">Workout Detail</h1>
        <span className="w-9" />
      </div>

      <div className="mb-3 flex items-center gap-3">
        <Avatar photoURL={profile.photoURL} name={profile.username} />
        <div>
          <div>{profile.username}</div>
          <div className="text-sm text-muted">{formatDate(workout.startedAt)}</div>
        </div>
      </div>
      <h2 className="mb-3 text-2xl font-semibold">{workout.name}</h2>
      <div className="border-b border-line pb-4">
        <WorkoutStats workout={workout} unit={profile.unit} />
      </div>

      <div className="divide-y divide-line">
        {workout.exercises.map((ex, i) => (
          <section key={i} className="py-5">
            <Link
              href={`/exercises/${encodeURIComponent(ex.exerciseId)}`}
              className="mb-3 flex items-center gap-3"
            >
              <ExerciseThumb exerciseId={ex.exerciseId} size={40} />
              <span className="text-lg font-semibold text-accent">{ex.name}</span>
            </Link>
            <div className="mb-1 flex gap-4 px-2 text-xs uppercase text-muted">
              <span className="w-5 text-center">Set</span>
              <span>Weight & Reps</span>
            </div>
            <SetList sets={ex.sets} unit={profile.unit} />
          </section>
        ))}
      </div>

      <button onClick={onDelete} className="mt-4 w-full rounded-xl bg-surface py-3 font-medium text-red-400">
        Delete Workout
      </button>
    </div>
  );
}
