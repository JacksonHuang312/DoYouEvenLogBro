"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { GameState } from "@/lib/game/claim";
import { monthStart } from "@/lib/game/calendar";
import type { ScheduleDoc } from "@/lib/game/schedule";
import type { ExerciseLookup } from "@/lib/game/sets";
import { dayId, dayStartMs } from "@/lib/game/time";
import { planMonth } from "@/lib/game/train";
import { useWorkouts } from "@/lib/useWorkouts";
import { MARK } from "./planMark";
import { Skeleton } from "./RpgScreen";

const DAY_MS = 24 * 60 * 60 * 1000;
const ARROW = "flex h-11 w-11 items-center justify-center text-rpg-text-2 disabled:opacity-30";

/**
 * Quests · Calendar (GAME_DESIGN.md 13.25): a month of the plan, each day marked like the Train
 * week strip. Arrows change the month; tapping a day shows its line under the grid. Read-only.
 * It loads the month's workouts itself, so nothing is read until the section is opened.
 */
export function PlanCalendar({
  uid,
  routines,
  schedule,
  state,
  lookup,
  now,
  timeZone,
}: {
  uid: string;
  routines: { id: string; name: string }[] | null;
  schedule: ScheduleDoc | null;
  state: Pick<GameState, "pauses"> | null;
  lookup: ExerciseLookup;
  now: number;
  timeZone: string;
}) {
  const today = dayId(now, timeZone);
  const [month, setMonth] = useState(() => monthStart(today));
  const [picked, setPicked] = useState<string | null>(today);
  // The month, and a week before it for workouts that filled one of its days late.
  const since = useMemo(() => dayStartMs(month, timeZone) - 8 * DAY_MS, [month, timeZone]);
  const workouts = useWorkouts(uid, { since }).workouts;

  const view = useMemo(
    () => (routines && workouts ? planMonth({ schedule, state, routines, workouts, lookup, now, timeZone, month }) : null),
    [routines, workouts, schedule, state, lookup, now, timeZone, month],
  );
  const days = view?.weeks.flat() ?? [];
  const line = days.find((d) => d?.dayId === picked)?.line ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => view?.prev && setMonth(view.prev)}
          disabled={!view?.prev}
          aria-label="Earlier month"
          className={ARROW}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
          <span className="font-rpg-head text-lg font-semibold uppercase leading-none" aria-live="polite">
            {view?.label ?? " "}
          </span>
          <span className="text-[11px] text-rpg-muted">{view?.summary ?? " "}</span>
        </div>
        <button
          onClick={() => view?.next && setMonth(view.next)}
          disabled={!view?.next}
          aria-label="Later month"
          className={ARROW}
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] text-rpg-muted" aria-hidden>
        {["S", "M", "T", "W", "T", "F", "S"].map((letter, i) => (
          <span key={i}>{letter}</span>
        ))}
      </div>

      {view ? (
        <div role="group" aria-label={view.label} className="grid grid-cols-7">
          {days.map((d, i) =>
            d ? (
              <button
                key={d.dayId}
                onClick={() => setPicked(d.dayId)}
                aria-pressed={d.dayId === picked}
                aria-label={`${d.name} ${d.date}: ${d.paused ? "Paused" : d.label}`}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 border ${d.dayId === picked ? "border-rpg-line-strong" : "border-transparent"}`}
              >
                <span className={`text-[10px] leading-none ${d.isToday ? "text-rpg-text" : "text-rpg-muted"}`}>{d.date}</span>
                <span
                  className={`flex h-5 w-5 items-center justify-center border text-[11px] leading-none ${MARK[d.status].cls} ${d.predicted ? "border-dashed" : ""}`}
                >
                  {MARK[d.status].text}
                </span>
              </button>
            ) : (
              <span key={`pad-${i}`} />
            ),
          )}
        </div>
      ) : (
        <Skeleton className="h-56 w-full" />
      )}

      <p role="status" className="min-h-8 break-words text-xs text-rpg-text-2">
        {view ? (line ?? "Tap a day to see it.") : ""}
      </p>
      <p className="text-[11px] leading-relaxed text-rpg-muted">
        ✓ done · ~ a day or more early or late · – missed · + extra workout · an empty box is planned.
        {view?.anyPredicted ? " Dashed marks are predictions until your workouts sync." : ""}
      </p>
    </div>
  );
}
