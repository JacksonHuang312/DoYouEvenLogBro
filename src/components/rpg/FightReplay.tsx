"use client";

import { useEffect, useRef, useState } from "react";
import {
  replayAt,
  replayCooldowns,
  type CooldownRow,
  type ReplayRound,
} from "@/lib/game/battleView";
import { ActionIcon } from "./ActionIcon";
import { EnemyIcon } from "./EnemyIcon";

/** Shown seconds already are real seconds at 1× (see FIGHT_TIME_SCALE), so the clock runs 1:1; the speed button multiplies it. */
const PACE = 1;
const SPEEDS = [1, 2, 4];
/** Real seconds a finished round holds, showing how it ended, before the next one (or the result) starts. */
const HOLD_SEC = 1.3;

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

/** One action: its icon, name, the damage range it deals and how ready it is. The fill empties on use and refills; a ready one is lit. */
function ActionRow({ row }: { row: CooldownRow }) {
  const ready = row.fill >= 0.995;
  const pct = Math.round(row.fill * 100);
  return (
    <li
      className={`flex items-center gap-2 ${row.warn ? "text-rpg-warn" : ready ? "text-rpg-text" : "text-rpg-muted"}`}
    >
      <ActionIcon id={row.icon} size={22} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex justify-between gap-1 text-[11px] leading-none">
          <span className="truncate">
            {row.warn ? "Winding up" : row.label}
          </span>
          {row.range && (
            <span className="shrink-0 tabular-nums">{row.range}</span>
          )}
        </div>
        <div
          role="progressbar"
          aria-label={`${row.label} ${row.key === "ultimate" ? "charge" : "cooldown"}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-1.5 bg-rpg-line"
        >
          <div
            className={`h-full ${row.warn ? "bg-rpg-warn" : ready ? "bg-rpg-text" : "bg-rpg-text-2"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </li>
  );
}

/**
 * Plays a stored fight back (GAME_DESIGN.md 13.14 and 13.17): both health bars and every action's
 * cooldown follow the events, with a speed button and Skip. Presentation only, from what the server
 * already decided; each round ends on a short beat saying how it went, and the last hands over to
 * the result screen (or Skip does).
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
  // The hold is real time, so it reads the same at every speed.
  const holdFor = HOLD_SEC * pace;
  const finished = last && clock >= round.seconds + holdFor;

  useEffect(() => {
    skip.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  // The clock follows the real time between frames, so the bars move smoothly. A finished round
  // holds for a moment, then the next one starts.
  useEffect(() => {
    let frame = 0;
    let before = performance.now();
    const tick = (at: number) => {
      const dt = Math.min(0.1, (at - before) / 1000);
      before = at;
      setPos((p) => {
        const c = p.clock + dt * pace;
        const over = c >= rounds[p.index].seconds + HOLD_SEC * pace;
        return over && p.index + 1 < rounds.length
          ? { index: p.index + 1, clock: 0 }
          : { index: p.index, clock: c };
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pace, rounds]);

  // The last round's hold ends the replay and hands over to the result.
  useEffect(() => {
    if (finished) onDone();
  }, [finished, onDone]);

  const now = replayAt(round, clock);
  const rows = replayCooldowns(round, clock);
  const over = clock >= round.seconds;
  const beat = last
    ? round.won
      ? "Victory"
      : "Defeat"
    : round.won
      ? "Cleared"
      : "You fell";
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

        <section
          className="grid grid-cols-2 gap-x-5 border-b border-rpg-line px-5 py-4"
          aria-label="Actions"
        >
          {(["you", "foe"] as const).map((side) => (
            <div key={side} className="flex min-w-0 flex-col gap-3">
              <h2 className="truncate text-xs text-rpg-text-2">
                {side === "you" ? "You" : round.foe}
              </h2>
              <ul
                className="flex flex-col gap-3"
                aria-label={
                  side === "you" ? "Your actions" : `${round.foe}'s actions`
                }
              >
                {rows
                  .filter((r) => r.side === side)
                  .map((r) => (
                    <ActionRow key={r.key} row={r} />
                  ))}
              </ul>
            </div>
          ))}
        </section>

        <div className="flex flex-1 flex-col justify-end gap-2 px-5 py-5">
          {over && (
            <p
              key={index}
              className={`rpg-fade font-rpg-head text-[44px] font-bold uppercase leading-none ${round.won ? "text-rpg-good" : "text-rpg-bad"}`}
            >
              {beat}
            </p>
          )}
          <ol
            className="flex flex-col gap-1.5 text-[13px]"
            aria-label="What is happening"
            aria-live="off"
          >
            {now.lines.map((line, i) => (
              <li
                key={`${index}-${i}-${line}`}
                className={
                  i === now.lines.length - 1
                    ? "text-rpg-text"
                    : "text-rpg-muted"
                }
              >
                {line}
              </li>
            ))}
          </ol>
        </div>

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
