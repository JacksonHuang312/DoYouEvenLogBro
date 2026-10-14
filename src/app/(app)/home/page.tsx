"use client";

import { Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { useFollowing } from "@/components/Follow";
import { Spinner } from "@/components/Spinner";
import { Avatar, PageHeader, RailCard, Stat, WithRail } from "@/components/ui";
import { WorkoutPost } from "@/components/WorkoutSummary";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { useFeed, useFollowCounts, useProfiles } from "@/lib/follows";
import { formatDayAndTime } from "@/lib/format";
import { workoutPath } from "@/lib/social";
import type { UserProfile, Workout } from "@/lib/types";
import { countWorkouts, deleteWorkout } from "@/lib/workouts";

/** How many more posts "Load more" adds. */
const PAGE_SIZE = 20;

/** Your feed, like Hevy's: your workouts and those of everyone you follow, newest first. */
export default function HomePage() {
  const profile = useProfile();
  const following = useFollowing();
  const [max, setMax] = useState(PAGE_SIZE);
  const [count, setCount] = useState<number | null>(null);

  const followingUids = useMemo(() => (following ? [...following] : null), [following]);
  const sources = useMemo(() => (followingUids ? [profile.uid, ...followingUids] : null), [followingUids, profile.uid]);
  // Live and cache-first: shows instantly from the device, never stuck waiting on the network.
  const feed = useFeed(sources, max);
  const others = useProfiles(followingUids);
  const authors = useMemo(() => {
    const map = new Map<string, UserProfile>([[profile.uid, profile]]);
    others?.forEach((p) => map.set(p.uid, p));
    return map;
  }, [others, profile]);
  const loading = !feed || !others;
  const latestOwn = feed?.find((f) => f.ownerUid === profile.uid)?.workout;

  useEffect(() => {
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
    // The live list drops it by itself.
    setCount((c) => (c == null ? c : c - 1));
    deleteWorkout(profile.uid, id).catch((e) => errorDialog("Couldn't delete workout", e));
  }

  return (
    <WithRail
      rail={<HomeRail profile={profile} count={count} following={following?.size} latest={latestOwn} />}
    >
      <PageHeader title="Home">
        <Link href="/search" aria-label="Search users" className="lg:hidden">
          <Search size={26} />
        </Link>
      </PageHeader>
      {loading && <Spinner />}

      {!loading && following?.size === 0 && feed.length > 0 && (
        <Link href="/search" className="mb-4 flex items-center gap-3 rounded-xl bg-surface px-4 py-3">
          <UserPlus size={22} className="text-accent" />
          <span className="flex-1">Find friends to follow and see their workouts here.</span>
        </Link>
      )}

      {!loading && feed.length === 0 && (
        <div className="space-y-4 py-16 text-center">
          <p className="text-muted">
            {following?.size
              ? "No workouts yet. Yours and the people you follow will show up here."
              : "No workouts yet. Log one, or follow friends to see theirs here."}
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/workout" className="inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-on-accent">
              Start a workout
            </Link>
            <Link href="/search" className="inline-block rounded-lg bg-surface-2 px-5 py-2.5 font-medium">
              Find friends
            </Link>
          </div>
        </div>
      )}

      {!loading && (
        <div className="-mt-5 lg:mt-0">
          {feed.map(({ ownerUid, workout }) => {
            const author = authors.get(ownerUid);
            if (!author) return null;
            const mine = ownerUid === profile.uid;
            return (
              <WorkoutPost
                key={`${ownerUid}/${workout.id}`}
                workout={workout}
                profile={author}
                onDelete={mine ? () => onDelete(workout.id) : undefined}
              />
            );
          })}
        </div>
      )}

      {!loading && feed.length >= max && (
        <button
          onClick={() => setMax((m) => m + PAGE_SIZE)}
          className="mt-4 w-full rounded-xl bg-surface py-3 font-medium text-accent"
        >
          Load more
        </button>
      )}
    </WithRail>
  );
}

/** Desktop-only side panel: who you are, what you did last, and a way to start training. */
function HomeRail({
  profile,
  count,
  following,
  latest,
}: {
  profile: UserProfile;
  count: number | null;
  /** How many people you follow, from the live list; refetches the counts when it changes. */
  following?: number;
  latest?: Workout;
}) {
  const counts = useFollowCounts(profile.uid, following);
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
          <Link href={`/u/${profile.uid}/followers`}>
            <Stat label="Followers" value={counts.followers ?? "-"} />
          </Link>
          <Link href={`/u/${profile.uid}/following`}>
            <Stat label="Following" value={counts.following ?? "-"} />
          </Link>
        </div>
        <Link href="/profile" className="mt-5 block rounded-lg bg-surface-2 py-2.5 text-headline">
          See your profile
        </Link>
      </RailCard>

      {latest && (
        <RailCard>
          <h2 className="mb-2 text-title-3">Latest activity</h2>
          <Link href={workoutPath(profile.uid, latest.id)} data-press="none" className="block">
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
