"use client";

/* eslint-disable @next/next/no-img-element -- inline data-URL photo; next/image adds nothing here */
import { Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setLabels } from "@/lib/draft";
import { formatRelativeDay, formatShortDuration } from "@/lib/format";
import { useComments, workoutPath } from "@/lib/social";
import type { LoggedSet, Unit, UserProfile, Workout } from "@/lib/types";
import { formatWeight, kgTo } from "@/lib/units";
import { getWorkoutPhoto } from "@/lib/workouts";
import { CommentThread } from "./Comments";
import { SocialBar } from "./SocialBar";
import { Avatar, ExerciseThumb, OverflowMenu, Stat } from "./ui";

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
      {workout.recordCount ? (
        <Stat
          label="Records"
          value={
            <span className="flex items-center gap-1.5">
              <Trophy size={18} className="text-amber-400" />
              {workout.recordCount}
            </span>
          }
        />
      ) : null}
    </div>
  );
}

const RECORD_LABEL = { weight: "Heaviest weight", reps: "Most reps" } as const;

const PREVIEW_EXERCISES = 3;

/**
 * The workout's photo, loaded from its own doc only when the workout has one. The loaded photo
 * is tagged with its workout id, so a reused component never flashes another workout's photo.
 */
export function WorkoutPhoto({ ownerUid, workout }: { ownerUid: string; workout: Workout }) {
  const [loaded, setLoaded] = useState<{ id: string; photo: string | null } | null>(null);

  useEffect(() => {
    if (!workout.hasPhoto) return;
    getWorkoutPhoto(ownerUid, workout.id)
      .then((photo) => setLoaded({ id: workout.id, photo }))
      .catch(() => setLoaded({ id: workout.id, photo: null }));
  }, [ownerUid, workout.id, workout.hasPhoto]);

  if (!workout.hasPhoto) return null;
  const photo = loaded?.id === workout.id ? loaded.photo : undefined;
  if (photo === null) return null;
  return (
    <div className="overflow-hidden rounded-xl bg-surface-2">
      {photo ? (
        <img src={photo} alt={`Photo from ${workout.name}`} className="max-h-[32rem] w-full object-cover" />
      ) : (
        // Placeholder while it loads, so the post doesn't jump.
        <div className="aspect-[4/3] w-full animate-pulse" />
      )}
    </div>
  );
}

/** The workout's notes, keeping the line breaks they were written with. */
export function WorkoutDescription({ workout }: { workout: Workout }) {
  if (!workout.description) return null;
  return <p className="whitespace-pre-line break-words text-body">{workout.description}</p>;
}

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
  const hidden = workout.exercises.length - PREVIEW_EXERCISES;
  const comments = useComments(profile.uid, workout.id);
  const commentBox = useRef<HTMLTextAreaElement>(null);

  return (
    // Phones: full-bleed posts split by thick gray bars. Desktop: separate cards, like Hevy's web feed.
    <article className="-mx-4 border-surface px-4 py-5 not-last:border-b-8 lg:mx-0 lg:mb-4 lg:rounded-xl lg:border-0! lg:bg-surface lg:px-6">
      <div className="mb-3 flex items-center gap-3">
        <Avatar photoURL={profile.photoURL} name={profile.username} />
        <div className="min-w-0 flex-1">
          <div className="truncate">{profile.username}</div>
          <div className="text-sm text-muted">{formatRelativeDay(workout.startedAt)}</div>
        </div>
        {onDelete && (
          <OverflowMenu label="Workout options">
            {(close) => (
              <>
                <Link href={`/workouts/${workout.id}/edit`} className="block px-4 py-3">
                  Edit workout
                </Link>
                <button
                  onClick={() => {
                    close();
                    onDelete();
                  }}
                  className="w-full px-4 py-3 text-left text-red-400"
                >
                  Delete workout
                </button>
              </>
            )}
          </OverflowMenu>
        )}
      </div>

      <Link href={workoutPath(profile.uid, workout.id)} data-press="none" className="block">
        <h2 className="mb-3 text-xl font-semibold">{workout.name}</h2>
        {workout.description && (
          <div className="mb-3 line-clamp-3">
            <WorkoutDescription workout={workout} />
          </div>
        )}
        <div className="border-b border-line pb-3">
          <WorkoutStats workout={workout} unit={profile.unit} />
        </div>
        {workout.hasPhoto && (
          <div className="pt-4">
            <WorkoutPhoto ownerUid={profile.uid} workout={workout} />
          </div>
        )}
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
      <div className="mt-3 border-t border-line pt-1">
        <SocialBar
          workout={workout}
          author={profile}
          commentCount={comments?.length ?? null}
          onCommentClick={() => commentBox.current?.focus()}
        />
      </div>
      <div className="mt-2">
        <CommentThread
          ownerUid={profile.uid}
          workoutId={workout.id}
          comments={comments}
          variant="preview"
          inputRef={commentBox}
        />
      </div>
    </article>
  );
}

export function SetList({ sets, unit }: { sets: LoggedSet[]; unit: Unit }) {
  const labels = setLabels(sets);
  return (
    <ol className="space-y-1">
      {sets.map((s, i) => (
        <li key={i} className="flex items-center gap-4 rounded-md px-2 py-1 odd:bg-surface-2/50">
          <span className="w-5 text-center text-muted">{labels[i]}</span>
          <span className="flex-1 tabular-nums">{formatSet(unit, s)}</span>
          {s.record && (
            <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-footnote font-medium text-amber-400">
              <Trophy size={12} />
              {RECORD_LABEL[s.record]}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
