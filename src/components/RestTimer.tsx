"use client";

import { useEffect, useState } from "react";
import { adjustRest, stopRest } from "@/lib/draft";
import { formatClock } from "@/lib/format";
import { useWorkout } from "./WorkoutProvider";

function beep() {
  try {
    navigator.vibrate?.([200, 100, 200]);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => ctx.close();
  } catch {
    // Audio or vibration unavailable; the timer still clears.
  }
}

/** Floating rest countdown, derived from an end timestamp so it can't drift in background tabs. */
export function RestTimer() {
  const { draft, update } = useWorkout();
  const endsAt = draft?.restEndsAt ?? null;
  const total = draft?.restTotalSec ?? 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt == null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) {
        clearInterval(id);
        beep();
        update(stopRest);
      }
    }, 250);
    return () => clearInterval(id);
  }, [endsAt, update]);

  if (endsAt == null) return null;
  const remaining = Math.min(Math.max(0, endsAt - now), total * 1000);
  const pct = total ? (remaining / (total * 1000)) * 100 : 0;
  const btn = "rounded-md bg-surface-2 px-3 py-1.5 text-sm";

  return (
    // Sits just above the 4rem tab bar, which itself sits above the iPhone home bar.
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] z-10 mx-auto max-w-xl px-4">
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
        <div className="h-1 bg-accent" style={{ width: `${pct}%` }} />
        <div className="flex items-center gap-2 p-3">
          <span className="text-xs uppercase text-muted">Rest</span>
          <span className="flex-1 text-2xl font-semibold tabular-nums">{formatClock(remaining)}</span>
          <button className={btn} onClick={() => update((w) => adjustRest(w, -15))}>
            -15
          </button>
          <button className={btn} onClick={() => update((w) => adjustRest(w, 15))}>
            +15
          </button>
          <button
            className="rounded-md bg-accent text-on-accent px-3 py-1.5 text-sm font-medium"
            onClick={() => update(stopRest)}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
