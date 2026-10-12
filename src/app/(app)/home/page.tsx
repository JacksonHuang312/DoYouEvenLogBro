"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { Spinner } from "@/components/Spinner";
import { PageHeader } from "@/components/ui";
import { WorkoutPost } from "@/components/WorkoutSummary";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import type { Workout } from "@/lib/types";
import { deleteWorkout, listWorkouts } from "@/lib/workouts";

/** Your feed. Until following exists (phase 4) it shows your own workouts. */
export default function HomePage() {
  const profile = useProfile();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listWorkouts(profile.uid, 20)
      .then(setWorkouts)
      .catch((e: Error) => setError(e.message));
  }, [profile.uid]);

  async function onDelete(id: string) {
    const ok = await confirmDialog({
      title: "Delete workout?",
      message: "This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setWorkouts((ws) => ws?.filter((w) => w.id !== id) ?? null);
    deleteWorkout(profile.uid, id).catch((e) => errorDialog("Couldn't delete workout", e));
  }

  return (
    <div>
      <PageHeader title="Home" />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!workouts && !error && <Spinner />}
      {workouts?.length === 0 && (
        <div className="space-y-4 py-16 text-center">
          <p className="text-muted">No workouts yet. Your workouts will show up here.</p>
          <Link href="/workout" className="inline-block rounded-lg bg-accent text-on-accent px-5 py-2.5 font-medium">
            Start a workout
          </Link>
        </div>
      )}
      <div className="-mt-5">
        {workouts?.map((w) => (
          <WorkoutPost key={w.id} workout={w} profile={profile} onDelete={() => onDelete(w.id)} />
        ))}
      </div>
    </div>
  );
}
