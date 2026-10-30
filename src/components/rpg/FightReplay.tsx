"use client";

import { useEffect, useRef, useState } from "react";
import { replayAt, type ReplayRound } from "@/lib/game/battleView";
import { EnemyIcon } from "./EnemyIcon";

/** Fight seconds that pass per real second at 1×; the speed button multiplies it. */
const PACE = 3;
const SPEEDS = [1, 2, 4];
/** How long a finished round holds before the next one (or the result) starts. */
const HOLD_SEC = 1.2;

function Bar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-rpg-text-2">
        <span>{label}</span>
        <span className="tabular-nums">
          {value.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-2 bg-rpg-line"
      >
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Plays a stored fight back (GAME_DESIGN.md 13.14): both health bars follow the events, with a
 * speed button and Skip. Presentation only, from the events the server already decided; it hands
 * over to the result screen when it ends or is skipped.
 */
export function FightReplay({
  rounds,
  onDone,
}: {
  rounds: ReplayRound[];
  onDone: () => void;
}) {
  const [pos, setPos] = useState({ index: 0, clock: 0 });
  const [speed, setSpeed] = useState(0);
  const skip = useRef<HTMLButtonElement>(null);
  const { index, clock } = pos;
  const round = rounds[index];
  const pace = PACE * SPEEDS[speed];
  const last = index === rounds.length - 1;
  const finished = last && clock >= round.seconds + HOLD_SEC * PACE;

  useEffect(() => {
    skip.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  // The clock runs in fight seconds. A finished round holds for a moment, then the next one starts.
  useEffect(() => {
    const id = window.setInterval(() => {
      setPos((p) => {
        const c = p.clock + (50 / 1000) * pace;
        const over = c >= rounds[p.index].seconds + HOLD_SEC * PACE;
        return over && p.index + 1 < rounds.length
          ? { index: p.index + 1, clock: 0 }
          : { index: p.index, clock: c };
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [pace, rounds]);

  // The last round's hold ends the replay and hands over to the result.
  useEffect(() => {
    if (finished) onDone();
  }, [finished, onDone]);

  const now = replayAt(round, clock);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fight replay"
      className="fixed inset-0 z-50 overflow-y-auto bg-rpg-bg lg:pl-64"
    >
      <div className="mx-auto flex min-h-full max-w-[28rem] flex-col font-rpg-body text-rpg-text">
        <header className="flex items-center gap-3 border-b border-rpg-line px-5 pb-4 pt-[max(2rem,env(safe-area-inset-top))]">
          <EnemyIcon name={round.foe} size={56} />
          <div className="min-w-0">
            <div className="text-xs text-rpg-muted">
              {rounds.length > 1
                ? `Round ${index + 1} of ${rounds.length}`
                : "Replay"}
            </div>
            <h1 className="break-words font-rpg-head text-[32px] font-bold uppercase leading-[0.95]">
              {round.foe}
            </h1>
          </div>
        </header>

        <section
          className="flex flex-col gap-4 border-b border-rpg-line px-5 py-5"
          aria-label="Health"
        >
          <Bar
            label="You"
            value={now.hh}
            max={round.heroMax}
            tone="bg-rpg-accent"
          />
          <Bar
            label={round.foe}
            value={now.fh}
            max={round.foeMax}
            tone="bg-rpg-text-2"
          />
        </section>

        <ol
          className="flex flex-1 flex-col justify-end gap-1.5 px-5 py-5 text-[13px]"
          aria-label="What is happening"
          aria-live="off"
        >
          {now.lines.map((line, i) => (
            <li
              key={`${index}-${i}-${line}`}
              className={
                i === now.lines.length - 1 ? "text-rpg-text" : "text-rpg-muted"
              }
            >
              {line}
            </li>
          ))}
        </ol>

        <div className="sticky bottom-0 flex gap-2 bg-rpg-bg px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button
            onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)}
            className="min-h-11 w-24 border border-rpg-line-strong px-3 text-[13px] text-rpg-text-2"
            aria-label={`Speed ${SPEEDS[speed]}×, tap to change`}
          >
            {SPEEDS[speed]}×
          </button>
          <button
            ref={skip}
            onClick={onDone}
            className="min-h-11 flex-1 bg-rpg-text px-4 text-[13px] font-semibold text-rpg-bg"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
