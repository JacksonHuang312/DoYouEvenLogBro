"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { Spinner } from "@/components/Spinner";
import { Avatar, PageHeader, RailCard, Stat, WithRail } from "@/components/ui";
import { WorkoutPost } from "@/components/WorkoutSummary";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { formatDayAndTime } from "@/lib/format";
import { workoutPath } from "@/lib/social";
import type { UserProfile, Workout } from "@/lib/types";
import { countWorkouts, deleteWorkout, listWorkouts } from "@/lib/workouts";

/** Your feed. Until following exists (phase 4) it shows your own workouts. */
export default function HomePage() {
  const profile = useProfile();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listWorkouts(profile.uid, 20)
      .then(setWorkouts)
      .catch((e: Error) => setError(e.message));
    countWorkouts(profile.uid).then(setCount).catch(() => setCount(null));
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
    setCount((c) => (c == null ? c : c - 1));
    deleteWorkout(profile.uid, id).catch((e) => errorDialog("Couldn't delete workout", e));
  }

  return (
    <WithRail rail={<HomeRail profile={profile} count={count} latest={workouts?.[0]} />}>
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
      <div className="-mt-5 lg:mt-0">
        {workouts?.map((w) => (
          <WorkoutPost key={w.id} workout={w} profile={profile} onDelete={() => onDelete(w.id)} />
        ))}
      </div>
    </WithRail>
  );
}

/** Desktop-only side panel: who you are, what you did last, and a way to start training. */
function HomeRail({ profile, count, latest }: { profile: UserProfile; count: number | null; latest?: Workout }) {
  return (
    <>
      <RailCard className="text-center">
        <div className="flex justify-center">
          <Avatar photoURL={profile.photoURL} name={profile.username} size={72} />
        </div>
        <div className="mt-3 truncate text-headline">{profile.username}</div>
        <div className="truncate text-subhead text-muted">{profile.displayName}</div>
        <div className="mt-4 grid grid-cols-3">
          <Stat label="Workouts" value={count ?? "-"} />
          {/* Social graph arrives in phase 4. */}
          <Stat label="Followers" value={0} />
          <Stat label="Following" value={0} />
        </div>
        <Link href="/profile" className="mt-5 block rounded-lg bg-surface-2 py-2.5 text-headline">
          See your profile
        </Link>
      </RailCard>

      {latest && (
        <RailCard>
          <h2 className="mb-2 text-title-3">Latest activity</h2>
          <Link href={workoutPath(profile.uid, latest.id)} className="block">
            <div className="truncate text-headline">{latest.name}</div>
            <div className="text-subhead text-muted">{formatDayAndTime(latest.startedAt)}</div>
          </Link>
        </RailCard>
      )}

      <Link href="/workout" className="block rounded-xl bg-accent py-3 text-center text-headline text-on-accent">
        Start workout
      </Link>
    </>
  );
}
