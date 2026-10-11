"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { setLabels } from "@/lib/draft";
import { formatRelativeDay, formatShortDuration } from "@/lib/format";
import type { LoggedSet, Unit, UserProfile, Workout } from "@/lib/types";
import { formatWeight, kgTo } from "@/lib/units";
import { Avatar, ExerciseThumb, Stat } from "./ui";

export function formatSet(unit: Unit, set: LoggedSet) {
  return `${formatWeight(unit, set.weightKg)} × ${set.reps}`;
}

export function formatVolume(unit: Unit, kg: number) {
  return `${Math.round(kgTo(unit, kg)).toLocaleString()} ${unit === "lb" ? "lbs" : "kg"}`;
}

export function WorkoutStats({ workout, unit }: { workout: Workout; unit: Unit }) {
  return (
    <div className="flex gap-12">
      <Stat label="Time" value={formatShortDuration(workout.endedAt - workout.startedAt)} />
      <Stat label="Volume" value={formatVolume(unit, workout.volumeKg)} />
    </div>
  );
}

const PREVIEW_EXERCISES = 3;

/** A workout shown like a Hevy feed post: author, title, stats, exercise preview. */
export function WorkoutPost({
  workout,
  profile,
  onDelete,
}: {
  workout: Workout;
  profile: UserProfile;
  onDelete?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hidden = workout.exercises.length - PREVIEW_EXERCISES;

  return (
    <article className="-mx-4 border-b-8 border-surface px-4 py-5">
      <div className="mb-3 flex items-center gap-3">
        <Avatar photoURL={profile.photoURL} name={profile.username} />
        <div className="min-w-0 flex-1">
          <div className="truncate">{profile.username}</div>
          <div className="text-sm text-muted">{formatRelativeDay(workout.startedAt)}</div>
        </div>
        {onDelete && (
          <div className="relative">
            <button aria-label="Workout options" onClick={() => setMenuOpen((o) => !o)} className="p-1">
              <MoreHorizontal size={22} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-10 w-44 overflow-hidden rounded-xl bg-surface-2 shadow-lg">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full px-4 py-3 text-left text-red-400"
                >
                  Delete workout
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Link href={`/history/${workout.id}`} className="block">
        <h2 className="mb-3 text-xl font-semibold">{workout.name}</h2>
        <div className="border-b border-line pb-3">
          <WorkoutStats workout={workout} unit={profile.unit} />
        </div>
        <ul className="space-y-3 pt-4">
          {workout.exercises.slice(0, PREVIEW_EXERCISES).map((ex, i) => (
            <li key={i} className="flex items-center gap-4">
              <ExerciseThumb exerciseId={ex.exerciseId} />
              <span className="truncate">
                {ex.sets.length} {ex.sets.length === 1 ? "set" : "sets"} {ex.name}
              </span>
            </li>
          ))}
        </ul>
        {hidden > 0 && (
          <div className="pt-4 text-center text-muted">
            See {hidden} more {hidden === 1 ? "exercise" : "exercises"}
          </div>
        )}
      </Link>
    </article>
  );
}

export function SetList({ sets, unit }: { sets: LoggedSet[]; unit: Unit }) {
  const labels = setLabels(sets);
  return (
    <ol className="space-y-1">
      {sets.map((s, i) => (
        <li key={i} className="flex gap-4 rounded-md px-2 py-1 odd:bg-surface-2/50">
          <span className="w-5 text-center text-muted">{labels[i]}</span>
          <span className="tabular-nums">{formatSet(unit, s)}</span>
        </li>
      ))}
    </ol>
  );
}
