"use client";

import { CalendarDays, Dumbbell, Settings } from "lucide-react";
import Link from "next/link";
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
import { Spinner } from "@/components/Spinner";
import { Avatar, PageHeader, RailCard, Stat, WithRail } from "@/components/ui";
import { WorkoutPost } from "@/components/WorkoutSummary";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { useWorkouts } from "@/lib/useWorkouts";
import { countWorkouts, deleteWorkout } from "@/lib/workouts";

const METRICS: { id: Metric; label: string }[] = [
  { id: "duration", label: "Duration" },
  { id: "volume", label: "Volume" },
  { id: "reps", label: "Reps" },
];

export default function ProfilePage() {
  const profile = useProfile();
  const [count, setCount] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>("duration");
  // Start of the chart's first week. Fixed for the page's lifetime so the listener isn't resubscribed.
  const [since] = useState(() => weekStart(Date.now()) - (WEEKS - 1) * 7 * 86_400_000);
  // Live and cache-first: shows instantly from the device, never stuck waiting on the network.
  const recent = useWorkouts(profile.uid, { max: 20 }).workouts;
  const chartData = useWorkouts(profile.uid, { since }).workouts;

  useEffect(() => {
    countWorkouts(profile.uid).then(setCount).catch(() => setCount(null));
  }, [profile.uid]);

  const totals = useMemo(
    () => weeklyTotals(chartData ?? [], metric, profile.unit),
    [chartData, metric, profile.unit],
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
    setCount((c) => (c == null ? c : c - 1));
    deleteWorkout(profile.uid, id).catch((e) => errorDialog("Couldn't delete workout", e));
  }

  return (
    <div>
      <PageHeader title={profile.username}>
        <Link href="/settings" aria-label="Settings">
          <Settings size={26} />
        </Link>
      </PageHeader>

      {/* Phones: one column in this order. Desktop: workouts on the left, the rest in the right rail. */}
      <WithRail
        railOnMobile
        rail={
          <>
            <RailCard className="flex items-center gap-4">
              <Avatar photoURL={profile.photoURL} name={profile.username} size={76} />
              <div className="min-w-0 flex-1">
                <div className="mb-2 truncate font-semibold">{profile.displayName}</div>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Workouts" value={count ?? "-"} />
                  {/* Social graph arrives in phase 4. */}
                  <Stat label="Followers" value={0} />
                  <Stat label="Following" value={0} />
                </div>
              </div>
            </RailCard>

            <RailCard className="max-lg:pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg" aria-live="polite">
                  <span className="font-semibold">{metricLabel(metric, profile.unit, totals[shownWeek].value)}</span>{" "}
                  <span className="text-muted">{weeksAgoLabel(shownWeek, totals.length)}</span>
                </h2>
                <span className="text-sm text-accent">Last 3 months</span>
              </div>
              <div className="mt-6">
                <ActivityChart
                  totals={totals}
                  metric={metric}
                  unit={profile.unit}
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

            <RailCard className="max-lg:pt-4">
              <h2 className="mb-3 text-muted">Dashboard</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/exercises" className="flex items-center gap-3 rounded-xl bg-surface px-4 py-4 lg:bg-surface-2">
                  <Dumbbell size={24} />
                  Exercises
                </Link>
                <Link
                  href="/profile/calendar"
                  className="flex items-center gap-3 rounded-xl bg-surface px-4 py-4 lg:bg-surface-2"
                >
                  <CalendarDays size={24} />
                  Calendar
                </Link>
              </div>
            </RailCard>
          </>
        }
      >
        <h2 className="mt-8 text-muted lg:mt-0">Workouts</h2>
        {!recent && <Spinner />}
        {recent?.length === 0 && <p className="py-8 text-center text-muted">No workouts yet.</p>}
        <div className="-mt-2 lg:mt-3">
          {recent?.map((w) => (
            <WorkoutPost key={w.id} workout={w} profile={profile} onDelete={() => onDelete(w.id)} />
          ))}
        </div>
      </WithRail>
    </div>
  );
}

