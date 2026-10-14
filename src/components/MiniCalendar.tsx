"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RailCard } from "@/components/ui";
import { workoutPath } from "@/lib/social";
import type { UserProfile, Workout } from "@/lib/types";
import { useWorkouts } from "@/lib/useWorkouts";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * One month at a time, right on the profile, like Hevy: days you trained are filled in and
 * open that workout. On your own profile the heading opens the full calendar (with streaks).
 */
export function MiniCalendar({ profile, isMe }: { profile: UserProfile; isMe: boolean }) {
  const [now] = useState(() => new Date());
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstMonth = new Date(profile.createdAt);
  firstMonth.setDate(1);
  firstMonth.setHours(0, 0, 0, 0);

  // Months back from the current one.
  const [offset, setOffset] = useState(0);
  const month = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - offset, 1);
  const year = month.getFullYear();
  const index = month.getMonth();
  // The grid spills into the neighbouring months to fill whole weeks.
  const gridStart = new Date(year, index, 1 - month.getDay());
  const cells = Math.ceil((month.getDay() + new Date(year, index + 1, 0).getDate()) / 7) * 7;

  // Live and cache-first, like the rest of the profile.
  const { workouts } = useWorkouts(profile.uid, { since: gridStart.getTime() });

  // Workouts per day, oldest first, so a day opens its first workout.
  const byDay = useMemo(() => {
    const map = new Map<string, Workout[]>();
    for (const w of [...(workouts ?? [])].reverse()) {
      const key = dayKey(new Date(w.startedAt));
      map.set(key, [...(map.get(key) ?? []), w]);
    }
    return map;
  }, [workouts]);

  const today = dayKey(now);
  const canGoBack = month > firstMonth;

  return (
    <RailCard className="max-lg:pt-4">
      <h2 className="mb-3 font-semibold">
        {isMe ? (
          <Link href="/profile/calendar" className="inline-flex items-center gap-1">
            Calendar <ChevronRight size={18} className="text-muted" />
          </Link>
        ) : (
          "Calendar"
        )}
      </h2>

      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setOffset(offset + 1)}
          disabled={!canGoBack}
          aria-label="Previous month"
          className="rounded-full p-1.5 text-muted hover:bg-surface-2 disabled:invisible"
        >
          <ChevronLeft size={20} />
        </button>
        <span aria-live="polite">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button
          onClick={() => setOffset(offset - 1)}
          disabled={offset === 0}
          aria-label="Next month"
          className="rounded-full p-1.5 text-muted hover:bg-surface-2 disabled:invisible"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="pb-1 text-sm text-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: cells }, (_, i) => {
          const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
          const key = dayKey(date);
          const inMonth = date.getMonth() === index;
          const dayWorkouts = inMonth ? byDay.get(key) : undefined;
          const isToday = key === today;
          const circle = "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm";

          if (dayWorkouts) {
            const label = dayWorkouts.length > 1 ? `${dayWorkouts.length} workouts` : dayWorkouts[0].name;
            return (
              <Link
                key={key}
                href={workoutPath(profile.uid, dayWorkouts[0].id)}
                aria-label={`${label}, ${date.toLocaleDateString()}`}
                title={label}
                aria-current={isToday ? "date" : undefined}
                // Today with a workout: the filled circle plus a ring around it, set apart by a gap
                // in the card's color (the page's on phones, where the card has no background).
                className={`${circle} bg-accent font-medium text-on-accent ${isToday ? "ring-2 ring-accent ring-offset-2 ring-offset-canvas lg:ring-offset-surface" : ""}`}
              >
                {date.getDate()}
              </Link>
            );
          }
          return (
            <span
              key={key}
              aria-current={isToday ? "date" : undefined}
              // Today: an outlined circle, so it doesn't look like a filled-in workout day.
              className={`${circle} ${!inMonth ? "text-muted/50" : isToday ? "font-semibold text-accent ring-2 ring-accent ring-inset" : ""}`}
            >
              {date.getDate()}
            </span>
          );
        })}
      </div>
    </RailCard>
  );
}
