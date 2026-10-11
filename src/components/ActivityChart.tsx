"use client";

import { useState } from "react";
import type { Unit, Workout } from "@/lib/types";
import { formatNumber, kgTo } from "@/lib/units";

export type Metric = "duration" | "volume" | "reps";
export const WEEKS = 12;

const WEEK_MS = 7 * 86_400_000;

/** Monday 00:00 local time of the week containing `t`. */
export function weekStart(t: number) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function metricValue(metric: Metric, unit: Unit, w: Workout) {
  if (metric === "duration") return (w.endedAt - w.startedAt) / 3_600_000;
  if (metric === "volume") return kgTo(unit, w.volumeKg);
  return w.exercises.reduce((n, e) => n + e.sets.reduce((m, s) => m + s.reps, 0), 0);
}

export function metricLabel(metric: Metric, unit: Unit, value: number) {
  if (metric === "duration") {
    const v = value < 10 ? formatNumber(Math.round(value * 10) / 10) : String(Math.round(value));
    return `${v} ${v === "1" ? "hour" : "hours"}`;
  }
  if (metric === "volume") return `${Math.round(value).toLocaleString()} ${unit === "lb" ? "lbs" : "kg"}`;
  return `${Math.round(value).toLocaleString()} reps`;
}

/** Weekly totals for the last WEEKS weeks, oldest first. */
export function weeklyTotals(workouts: Workout[], metric: Metric, unit: Unit, now = Date.now()) {
  const first = weekStart(now) - (WEEKS - 1) * WEEK_MS;
  const totals = Array.from({ length: WEEKS }, (_, i) => ({ start: first + i * WEEK_MS, value: 0 }));
  for (const w of workouts) {
    // Round instead of floor so DST-shifted week boundaries still land in the right bucket.
    const i = Math.round((weekStart(w.startedAt) - first) / WEEK_MS);
    if (i >= 0 && i < WEEKS) totals[i].value += metricValue(metric, unit, w);
  }
  return totals;
}

/** Rounds a max up to a clean axis top split into 3 steps (1/2/5 × 10^n per step). */
function niceTop(max: number, metric: Metric) {
  if (max <= 0) return metric === "duration" ? 6 : 3;
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return step * 3;
}

function compact(n: number) {
  return n >= 1000 ? `${formatNumber(Math.round(n / 100) / 10)}K` : formatNumber(n);
}

const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function ActivityChart({ totals, metric, unit }: { totals: { start: number; value: number }[]; metric: Metric; unit: Unit }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceTop(Math.max(...totals.map((t) => t.value)), metric);
  const ticks = [0, 1, 2, 3].map((i) => (top / 3) * i);
  const suffix = metric === "duration" ? " hrs" : "";
  const height = 180;

  return (
    <figure className="select-none">
      <div className="flex gap-2">
        {/* y-axis labels */}
        <div className="relative w-12 shrink-0 text-right text-xs text-muted" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: height - (t / top) * height }}>
              {compact(t)}
              {suffix}
            </span>
          ))}
        </div>

        <div className="relative flex-1" style={{ height }} onMouseLeave={() => setActive(null)}>
          {/* hairline gridlines */}
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-line" style={{ top: height - (t / top) * height }} />
          ))}

          <div className="absolute inset-0 flex items-end">
            {totals.map((t, i) => (
              <button
                key={t.start}
                type="button"
                aria-label={`Week of ${shortDate(t.start)}: ${metricLabel(metric, unit, t.value)}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className="group relative flex h-full flex-1 items-end justify-center outline-none"
              >
                <span
                  className={`block w-full max-w-6 rounded-t ${active === i ? "bg-accent" : "bg-accent/85"}`}
                  style={{ height: (t.value / top) * height, marginInline: 1 }}
                />
              </button>
            ))}
          </div>

          {active != null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `${((active + 0.5) / totals.length) * 100}%` }}
            >
              <div className="text-muted">Week of {shortDate(totals[active].start)}</div>
              <div className="font-semibold">{metricLabel(metric, unit, totals[active].value)}</div>
            </div>
          )}
        </div>
      </div>

      {/* x-axis: every other week so labels never collide */}
      <div className="ml-14 flex pt-2 text-xs text-muted">
        {totals.map((t, i) => (
          <span key={t.start} className="flex-1 whitespace-nowrap text-center">
            {i % 2 === 0 ? shortDate(t.start) : ""}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Weekly totals</caption>
        <tbody>
          {totals.map((t) => (
            <tr key={t.start}>
              <th scope="row">Week of {shortDate(t.start)}</th>
              <td>{metricLabel(metric, unit, t.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
