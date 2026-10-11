"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { ExerciseMeta } from "@/components/ExercisePicker";
import { Spinner } from "@/components/Spinner";
import { BackHeader } from "@/components/ui";
import { formatSet, SetList } from "@/components/WorkoutSummary";
import { deleteCustomExercise, useExercises } from "@/lib/exercises";
import { formatDate } from "@/lib/format";
import type { LoggedSet, Workout } from "@/lib/types";
import { listWorkoutsWithExercise } from "@/lib/workouts";

export function ExerciseDetail() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const profile = useProfile();
  const router = useRouter();
  const exercise = useExercises(profile.uid).find((e) => e.id === id);
  const [history, setHistory] = useState<Workout[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listWorkoutsWithExercise(profile.uid, id)
      .then(setHistory)
      .catch((e: Error) => setError(e.message));
  }, [profile.uid, id]);

  const sessions = (history ?? []).map((w) => ({
    workout: w,
    sets: w.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets),
  }));
  const heaviest = sessions
    .flatMap((s) => s.sets)
    .reduce<LoggedSet | null>(
      (best, s) => ((s.weightKg ?? 0) > (best?.weightKg ?? -1) ? s : best),
      null,
    );

  function onDelete() {
    if (!confirm("Delete this custom exercise? Past workouts keep their sets.")) return;
    deleteCustomExercise(profile.uid, id).catch((e: Error) => alert(e.message));
    router.replace("/exercises");
  }

  return (
    <div className="space-y-4">
      <BackHeader title="Exercise" href="/exercises" />
      <div>
        <h1 className="text-2xl font-bold">{exercise?.name ?? sessions[0]?.workout.exercises.find((e) => e.exerciseId === id)?.name ?? "Exercise"}</h1>
        {exercise && <ExerciseMeta exercise={exercise} />}
      </div>

      {heaviest && (
        <div className="rounded-xl bg-surface p-4">
          <div className="text-xs text-muted">Heaviest set</div>
          <div className="text-lg font-semibold">{formatSet(profile.unit, heaviest)}</div>
        </div>
      )}

      <h2 className="font-semibold">History</h2>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!history && !error && <Spinner />}
      {history?.length === 0 && <p className="text-sm text-muted">Not logged yet.</p>}
      {sessions.map(({ workout, sets }) => (
        <Link key={workout.id} href={`/history/${workout.id}`} className="block rounded-xl bg-surface p-4">
          <div className="mb-2 text-sm text-muted">
            {workout.name} · {formatDate(workout.startedAt)}
          </div>
          <SetList sets={sets} unit={profile.unit} />
        </Link>
      ))}

      {exercise?.custom && (
        <button onClick={onDelete} className="w-full rounded-xl py-3 text-sm text-red-400">
          Delete custom exercise
        </button>
      )}
    </div>
  );
}
