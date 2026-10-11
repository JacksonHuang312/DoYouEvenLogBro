"use client";

import { Dumbbell, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ActivityChart, type Metric, metricLabel, WEEKS, weeklyTotals, weekStart } from "@/components/ActivityChart";
import { useProfile } from "@/components/AuthProvider";
import { Spinner } from "@/components/Spinner";
import { Avatar, PageHeader, Stat } from "@/components/ui";
import { WorkoutPost } from "@/components/WorkoutSummary";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import type { Workout } from "@/lib/types";
import { countWorkouts, deleteWorkout, listWorkouts, listWorkoutsSince } from "@/lib/workouts";

const METRICS: { id: Metric; label: string }[] = [
  { id: "duration", label: "Duration" },
  { id: "volume", label: "Volume" },
  { id: "reps", label: "Reps" },
];

export default function ProfilePage() {
  const profile = useProfile();
  const [count, setCount] = useState<number | null>(null);
  const [recent, setRecent] = useState<Workout[] | null>(null);
  const [chartData, setChartData] = useState<Workout[]>([]);
  const [metric, setMetric] = useState<Metric>("duration");

  useEffect(() => {
    countWorkouts(profile.uid).then(setCount).catch(() => setCount(null));
    listWorkouts(profile.uid, 20).then(setRecent).catch(() => setRecent([]));
    const since = weekStart(Date.now()) - (WEEKS - 1) * 7 * 86_400_000;
    listWorkoutsSince(profile.uid, since).then(setChartData).catch(() => setChartData([]));
  }, [profile.uid]);

  const totals = useMemo(() => weeklyTotals(chartData, metric, profile.unit), [chartData, metric, profile.unit]);

  async function onDelete(id: string) {
    const ok = await confirmDialog({
      title: "Delete workout?",
      message: "This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setRecent((ws) => ws?.filter((w) => w.id !== id) ?? null);
    setChartData((ws) => ws.filter((w) => w.id !== id));
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

      <div className="flex items-center gap-6">
        <Avatar photoURL={profile.photoURL} name={profile.username} size={88} />
        <div className="min-w-0 flex-1">
          <div className="mb-2 truncate font-semibold">{profile.displayName}</div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Workouts" value={count ?? "-"} />
            {/* Social graph arrives in phase 4. */}
            <Stat label="Followers" value={0} />
            <Stat label="Following" value={0} />
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-baseline justify-between gap-2">
        <h2 className="text-lg">
          <span className="font-semibold">{metricLabel(metric, profile.unit, totals[totals.length - 1].value)}</span>{" "}
          <span className="text-muted">this week</span>
        </h2>
        <span className="text-sm text-accent">Last 3 months</span>
      </div>
      <div className="mt-6">
        <ActivityChart totals={totals} metric={metric} unit={profile.unit} />
      </div>

      <div className="mt-4 flex gap-3">
        {METRICS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMetric(m.id)}
            aria-pressed={metric === m.id}
            className={`rounded-full px-4 py-1.5 ${metric === m.id ? "bg-accent" : "bg-surface"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-muted">Dashboard</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/exercises" className="flex items-center gap-3 rounded-xl bg-surface px-4 py-4">
          <Dumbbell size={24} />
          Exercises
        </Link>
      </div>

      <h2 className="mt-8 text-muted">Workouts</h2>
      {!recent && <Spinner />}
      {recent?.length === 0 && <p className="py-8 text-center text-muted">No workouts yet.</p>}
      <div className="-mt-2">
        {recent?.map((w) => (
          <WorkoutPost key={w.id} workout={w} profile={profile} onDelete={() => onDelete(w.id)} />
        ))}
      </div>
    </div>
  );
}

