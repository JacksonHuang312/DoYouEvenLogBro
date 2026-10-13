"use client";

import { Flame, Moon } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { Spinner } from "@/components/Spinner";
import { BackHeader } from "@/components/ui";
import { workoutPath } from "@/lib/social";
import type { Workout } from "@/lib/types";
import { useWorkouts } from "@/lib/useWorkouts";

/** How far back the calendar goes (or to account creation, if that's sooner). */
const MAX_MONTHS = 12;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Start of the Sunday-based week containing `t`, matching the calendar's columns. */
function sundayWeekStart(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/**
 * Consecutive weeks with at least one workout. A week with nothing logged yet doesn't
 * break the streak until it's over, so counting starts from last week in that case.
 */
function weekStreak(workouts: Workout[], now: number) {
  const weeks = new Set(workouts.map((w) => sundayWeekStart(w.startedAt).getTime()));
  const week = sundayWeekStart(now);
  if (!weeks.has(week.getTime())) week.setDate(week.getDate() - 7);
  let streak = 0;
  while (weeks.has(week.getTime())) {
    streak++;
    week.setDate(week.getDate() - 7);
  }
  return streak;
}

/** Whole days since the most recent workout (0 if you trained today). */
function restDays(workouts: Workout[], now: number) {
  if (workouts.length === 0) return null;
  const last = Math.max(...workouts.map((w) => w.startedAt));
  const startOfDay = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  return Math.round((startOfDay(now) - startOfDay(last)) / 86_400_000);
}

/** First-of-month dates from `from` through the month of `now`, oldest first. */
function monthsBetween(from: number, now: number) {
  const end = new Date(now);
  const first = new Date(end.getFullYear(), end.getMonth() - (MAX_MONTHS - 1), 1);
  const created = new Date(from);
  const start = created > first ? new Date(created.getFullYear(), created.getMonth(), 1) : first;
  const months: Date[] = [];
  for (const m = start; m <= end; m.setMonth(m.getMonth() + 1)) months.push(new Date(m));
  return months;
}

export default function CalendarPage() {
  const profile = useProfile();
  const [now] = useState(() => Date.now());
  const months = useMemo(() => monthsBetween(profile.createdAt, now), [profile.createdAt, now]);
  // Live and cache-first: shows instantly from the device, never stuck waiting on the network.
  const { workouts } = useWorkouts(profile.uid, { since: months[0].getTime() });

  // Workouts per day, oldest first, so a day's label is its first workout.
  const byDay = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const w of [...(workouts ?? [])].reverse()) {
      const key = dayKey(new Date(w.startedAt));
      map.set(key, [...(map.get(key) ?? []), w]);
    }
    return map;
  }, [workouts]);

  // Open on the current month, at the bottom, like Hevy. Only once: the list is live, and
  // a later update (the server answering after the cache) mustn't yank you back down.
  const scrolled = useRef(false);
  const loaded = workouts != null;
  useLayoutEffect(() => {
    if (!loaded || scrolled.current) return;
    scrolled.current = true;
    window.scrollTo(0, document.documentElement.scrollHeight);
  }, [loaded]);

  const rest = workouts && restDays(workouts, now);

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 bg-black px-4">
        <BackHeader title="Calendar" href="/profile" />
        <div className="-mx-4 -mt-4 grid grid-cols-2 divide-x divide-line border-y border-line bg-surface py-3 text-center">
          <span className="flex items-center justify-center gap-2">
            <Flame size={20} className="fill-orange-500 text-orange-500" />
            {workouts ? weekStreak(workouts, now) : "-"} week streak
          </span>
          <span className="flex items-center justify-center gap-2">
            <Moon size={20} className="fill-accent text-accent" />
            {rest ?? "-"} rest {rest === 1 ? "day" : "days"}
          </span>
        </div>
        <div className="-mx-4 grid grid-cols-7 border-b border-line bg-surface py-2 text-center text-sm text-muted">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>

      {!workouts ? (
        <Spinner />
      ) : (
        months.map((m) => <Month key={m.getTime()} month={m} byDay={byDay} today={dayKey(new Date(now))} uid={profile.uid} />)
      )}
    </div>
  );
}

function Month({
  month,
  byDay,
  today,
  uid,
}: {
  month: Date;
  byDay: Map<string, Workout[]>;
  today: string;
  uid: string;
}) {
  const year = month.getFullYear();
  const index = month.getMonth();
  const blanks = new Date(year, index, 1).getDay();
  const days = new Date(year, index + 1, 0).getDate();

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-xl font-bold">
        {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
      </h2>
      <div className="grid grid-cols-7">
        {Array.from({ length: blanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = new Date(year, index, i + 1);
          const key = dayKey(date);
          return <Day key={key} day={i + 1} workouts={byDay.get(key)} isToday={key === today} uid={uid} />;
        })}
      </div>
    </section>
  );
}

function Day({ day, workouts, isToday, uid }: { day: number; workouts?: Workout[]; isToday: boolean; uid: string }) {
  const cell = "flex h-[4.5rem] min-w-0 flex-col items-center border-t border-line pt-1.5";

  if (!workouts) {
    return (
      <div className={cell}>
        <span className={`flex h-10 w-10 items-center justify-center text-lg ${isToday ? "font-semibold text-accent" : ""}`}>
          {day}
        </span>
      </div>
    );
  }

  // Multiple workouts on one day: open the first and say how many there were.
  const label = workouts.length > 1 ? `${workouts.length} workouts` : workouts[0].name;
  return (
    <Link href={workoutPath(uid, workouts[0].id)} className={cell} aria-label={`${label}, day ${day}`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-on-accent text-lg">{day}</span>
      <span className="mt-0.5 w-full truncate px-0.5 text-center text-[11px] text-muted">{label}</span>
    </Link>
  );
}
