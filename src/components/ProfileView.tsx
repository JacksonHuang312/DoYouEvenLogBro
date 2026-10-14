"use client";

import { ChevronLeft, Dumbbell, Lock, Settings, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityChart,
  type Metric,
  metricLabel,
  WEEKS,
  weeklyTotals,
  weeksAgoLabel,
  weekStart,
} from "@/components/ActivityChart";
import { useProfile } from "@/components/AuthProvider";
import { MiniCalendar } from "@/components/MiniCalendar";
import { Spinner } from "@/components/Spinner";
import { Avatar, PageHeader, RailCard, Stat, WithRail } from "@/components/ui";
import { WorkoutPost } from "@/components/WorkoutSummary";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { profilePath, useFollowCounts, useFollowRequests } from "@/lib/follows";
import type { UserProfile } from "@/lib/types";
import { useWorkouts } from "@/lib/useWorkouts";
import { countWorkouts, deleteWorkout } from "@/lib/workouts";
import { FollowButton, useFollowStatus } from "./Follow";

const METRICS: { id: Metric; label: string }[] = [
  { id: "duration", label: "Duration" },
  { id: "volume", label: "Volume" },
  { id: "reps", label: "Reps" },
];

/**
 * A profile: yours (/profile) or someone else's (/u/{uid}), like Hevy. Private accounts only
 * show their workouts to the owner and approved followers; everyone else sees a lock.
 */
export function ProfileView({ profile }: { profile: UserProfile }) {
  const viewer = useProfile();
  const router = useRouter();
  const isMe = viewer.uid === profile.uid;
  const status = useFollowStatus(profile);
  const canSee = isMe || !profile.isPrivate || status === "following";

  return (
    <div>
      {isMe ? (
        <PageHeader title={profile.username}>
          <Link href="/settings" aria-label="Settings">
            <Settings size={26} />
          </Link>
        </PageHeader>
      ) : (
        <header className="-ml-2 flex items-center gap-1 pb-4 pt-2">
          <button onClick={() => router.back()} aria-label="Back" className="p-1 text-accent">
            <ChevronLeft size={28} />
          </button>
          <h1 className="truncate text-3xl font-bold">{profile.username}</h1>
        </header>
      )}

      {status == null ? (
        <Spinner />
      ) : canSee ? (
        <VisibleProfile profile={profile} isMe={isMe} status={status} />
      ) : (
        <WithRail railOnMobile rail={<ProfileCard profile={profile} isMe={false} status={status} workouts={null} />}>
          <div className="space-y-2 py-16 text-center lg:rounded-xl lg:bg-surface">
            <Lock className="mx-auto text-muted" size={32} />
            <h2 className="text-headline">This account is private</h2>
            <p className="text-muted">Follow {profile.username} to see their workouts.</p>
          </div>
        </WithRail>
      )}
    </div>
  );
}

/** Avatar, name, counts and the Follow button (or, on your own profile, pending requests). */
function ProfileCard({
  profile,
  isMe,
  status,
  workouts,
}: {
  profile: UserProfile;
  isMe: boolean;
  status: string;
  workouts: number | null;
}) {
  // Refetch the counts when the viewer follows or unfollows.
  const counts = useFollowCounts(profile.uid, status);
  const requests = useFollowRequests(isMe ? profile.uid : null);
  const base = profilePath(profile.uid);

  return (
    <RailCard>
      <div className="flex items-center gap-4">
        <Avatar photoURL={profile.photoURL} name={profile.username} size={76} />
        <div className="min-w-0 flex-1">
          <div className="mb-2 truncate font-semibold">{profile.displayName}</div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Workouts" value={workouts ?? "-"} />
            <Link href={`${base}/followers`}>
              <Stat label="Followers" value={counts.followers ?? "-"} />
            </Link>
            <Link href={`${base}/following`}>
              <Stat label="Following" value={counts.following ?? "-"} />
            </Link>
          </div>
        </div>
      </div>
      {!isMe && (
        <div className="mt-4">
          <FollowButton target={profile} block />
        </div>
      )}
      {isMe && requests && requests.length > 0 && (
        <Link
          href="/profile/requests"
          className="mt-4 flex items-center gap-3 rounded-xl bg-surface px-4 py-3 lg:bg-surface-2"
        >
          <UserPlus size={22} className="text-accent" />
          <span className="flex-1">Follow requests</span>
          <span className="rounded-full bg-accent px-2 py-0.5 text-caption font-semibold text-on-accent">
            {requests.length}
          </span>
        </Link>
      )}
    </RailCard>
  );
}

function VisibleProfile({ profile, isMe, status }: { profile: UserProfile; isMe: boolean; status: string }) {
  const viewer = useProfile();
  const [count, setCount] = useState<{ uid: string; count: number | null } | null>(null);
  const [metric, setMetric] = useState<Metric>("duration");
  // Start of the chart's first week. Fixed for the page's lifetime so the listener isn't resubscribed.
  const [since] = useState(() => weekStart(Date.now()) - (WEEKS - 1) * 7 * 86_400_000);
  // Live and cache-first: shows instantly from the device, never stuck waiting on the network.
  const recent = useWorkouts(profile.uid, { max: 20 }).workouts;
  const chartData = useWorkouts(profile.uid, { since }).workouts;

  useEffect(() => {
    countWorkouts(profile.uid)
      .then((n) => setCount({ uid: profile.uid, count: n }))
      .catch(() => setCount({ uid: profile.uid, count: null }));
  }, [profile.uid]);
  const workoutCount = count?.uid === profile.uid ? count.count : null;

  // Weights in the viewer's unit, whoever's profile it is.
  const totals = useMemo(
    () => weeklyTotals(chartData ?? [], metric, viewer.unit),
    [chartData, metric, viewer.unit],
  );
  // The heading follows the hovered/tapped bar, and shows this week otherwise.
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const shownWeek = activeWeek ?? totals.length - 1;

  async function onDelete(id: string) {
    const ok = await confirmDialog({
      title: "Delete workout?",
      message: "This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    // The live lists drop it by themselves.
    setCount((c) => (c?.count == null ? c : { ...c, count: c.count - 1 }));
    deleteWorkout(profile.uid, id).catch((e) => errorDialog("Couldn't delete workout", e));
  }

  return (
    // Phones: one column in this order. Desktop: workouts on the left, the rest in the right rail.
    <WithRail
      railOnMobile
      rail={
        <>
          <ProfileCard profile={profile} isMe={isMe} status={status} workouts={workoutCount} />

          <RailCard className="max-lg:pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg" aria-live="polite">
                <span className="font-semibold">{metricLabel(metric, viewer.unit, totals[shownWeek].value)}</span>{" "}
                <span className="text-muted">{weeksAgoLabel(shownWeek, totals.length)}</span>
              </h2>
              <span className="text-sm text-accent">Last 3 months</span>
            </div>
            <div className="mt-6">
              <ActivityChart
                totals={totals}
                metric={metric}
                unit={viewer.unit}
                active={activeWeek}
                setActive={setActiveWeek}
              />
            </div>

            <div className="mt-4 flex gap-3">
              {METRICS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMetric(m.id)}
                  aria-pressed={metric === m.id}
                  className={`rounded-full px-4 py-1.5 ${metric === m.id ? "bg-accent text-on-accent" : "bg-surface lg:bg-surface-2"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </RailCard>

          <MiniCalendar profile={profile} isMe={isMe} />

          {/* Exercise history is personal, so only your own profile links it. */}
          {isMe && (
            <RailCard className="max-lg:pt-4">
              <h2 className="mb-3 text-muted">Dashboard</h2>
              <Link href="/exercises" className="flex items-center gap-3 rounded-xl bg-surface px-4 py-4 lg:bg-surface-2">
                <Dumbbell size={24} />
                Exercises
              </Link>
            </RailCard>
          )}
        </>
      }
    >
      <h2 className="mt-8 text-muted lg:mt-0">Workouts</h2>
      {!recent && <Spinner />}
      {recent?.length === 0 && <p className="py-8 text-center text-muted">No workouts yet.</p>}
      <div className="-mt-2 lg:mt-3">
        {recent?.map((w) => (
          <WorkoutPost
            key={w.id}
            workout={w}
            profile={profile}
            onDelete={isMe ? () => onDelete(w.id) : undefined}
          />
        ))}
      </div>
    </WithRail>
  );
}
