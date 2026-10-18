"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import type { GameState } from "@/lib/game/claim";
import { INJURY, PAUSE, STATS, type Stat } from "@/lib/game/config";
import { STAT_LABELS } from "@/lib/game/view";
import { injuryView, pausePlan, pauseView } from "@/lib/game/breaksView";
import {
  clearInjury,
  endPause,
  flagInjury,
  renewInjury,
  setInjuryVisibility,
  startPause,
} from "@/lib/gameApi";
import { dayId } from "@/lib/game/time";
import { OfflineNote } from "./Disclosure";

const SECONDARY = "min-h-11 border border-rpg-line-strong px-3 text-[13px] text-rpg-text-2 disabled:opacity-40";
const PRIMARY = "min-h-11 bg-rpg-text px-4 text-[13px] font-semibold text-rpg-bg disabled:opacity-40";
const STEP = "flex h-11 w-11 shrink-0 items-center justify-center border border-rpg-line-strong text-rpg-text-2 disabled:opacity-40";
const FIELD = "min-h-11 w-full border border-rpg-line-strong bg-rpg-bg px-3 text-[13px] text-rpg-text";
const SUBHEAD = "font-rpg-head text-lg font-semibold uppercase";

/**
 * Pause mode and injury flags (GAME_DESIGN.md 3.6). What is shown comes from game/state, live;
 * every action is a server call, so the controls turn off when the device is offline.
 */
export function BreaksPanel({
  state,
  now,
  timeZone,
  online,
}: {
  state: GameState | null;
  now: number;
  timeZone: string;
  online: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /** Runs one server action: one at a time, with the error shown if it fails. */
  async function run(title: string, action: () => Promise<{ swappedQuests?: boolean }>, done?: string) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await action();
      setNotice(res.swappedQuests ? "Quests for that stat were replaced." : (done ?? null));
    } catch (err) {
      void errorDialog(title, err);
    } finally {
      setBusy(false);
    }
  }

  const off = busy || !online;
  return (
    <>
      {!online && <OfflineNote what="Pause and injury changes" />}
      <PausePart state={state} now={now} timeZone={timeZone} off={off} run={run} />
      <InjuryPart state={state} now={now} timeZone={timeZone} off={off} run={run} />
      {notice && (
        <p role="status" className="text-xs text-rpg-good">
          {notice}
        </p>
      )}
    </>
  );
}

type Run = (title: string, action: () => Promise<{ swappedQuests?: boolean }>, done?: string) => Promise<void>;
interface PartProps {
  state: GameState | null;
  now: number;
  timeZone: string;
  off: boolean;
  run: Run;
}

function PausePart({ state, now, timeZone, off, run }: PartProps) {
  const [days, setDays] = useState(14);
  const view = pauseView(state, now, timeZone);
  const plan = pausePlan(state, days, now, timeZone);

  async function start() {
    const ok = await confirmDialog({
      title: `Pause for ${days} days?`,
      message: `Decay and your schedule freeze until ${plan.backOn}. You can end it early after ${PAUSE.minDays} days, and the next pause can't start for ${PAUSE.cooldownDays} days after this one.`,
      confirmLabel: "Start pause",
    });
    if (ok) await run("Couldn't start the pause", () => startPause(days), `Paused until ${plan.backOn}.`);
  }

  async function end() {
    const ok = await confirmDialog({
      title: "End your pause?",
      message: `Decay and your schedule start again today. The next pause can't start for ${PAUSE.cooldownDays} days.`,
      confirmLabel: "End pause",
    });
    if (ok) await run("Couldn't end the pause", endPause, "Pause ended.");
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className={SUBHEAD}>Pause</h3>
      {view.active ? (
        <>
          <p className="text-xs leading-relaxed text-rpg-text-2">
            Paused until {view.active.backOn} ({view.active.daysLeft} {view.active.daysLeft === 1 ? "day" : "days"} left).
            Decay and your schedule are frozen. You can still log workouts.
          </p>
          <button onClick={() => void end()} disabled={off || !view.active.canEndNow} className={SECONDARY}>
            End pause early
          </button>
          {!view.active.canEndNow && (
            <p className="text-[11px] text-rpg-muted">You can end it early from {view.active.canEndFrom}.</p>
          )}
        </>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-rpg-text-2">
            Away for a while? A pause freezes decay and your schedule. {PAUSE.minDays} to {PAUSE.maxDays} days.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDays((d) => Math.max(PAUSE.minDays, d - 1))}
              disabled={days <= PAUSE.minDays}
              aria-label="One day shorter"
              className={STEP}
            >
              <Minus size={16} aria-hidden />
            </button>
            <div aria-live="polite" className="min-w-0 flex-1 border border-rpg-line px-2 py-2.5 text-center text-[13px]">
              {days} days · back {plan.backOn}
            </div>
            <button
              onClick={() => setDays((d) => Math.min(PAUSE.maxDays, d + 1))}
              disabled={days >= PAUSE.maxDays}
              aria-label="One day longer"
              className={STEP}
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>
          <button onClick={() => void start()} disabled={off || plan.error != null} className={PRIMARY}>
            Start pause
          </button>
          {view.nextPauseFrom ? (
            <p className="text-[11px] text-rpg-muted">The next pause can start from {view.nextPauseFrom}.</p>
          ) : (
            plan.error && <p className="text-[11px] text-rpg-muted">{plan.error}.</p>
          )}
        </>
      )}
    </div>
  );
}

function InjuryPart({ state, now, timeZone, off, run }: PartProps) {
  const view = injuryView(state, now, timeZone);
  const today = dayId(now, timeZone);
  const [stat, setStat] = useState<Stat | "">("");
  const [back, setBack] = useState("");
  const [note, setNote] = useState("");

  // The picked stat, or the first one still free if the pick is no longer available.
  const chosen = view.flaggable.find((f) => f.stat === stat)?.stat ?? view.flaggable[0]?.stat;

  async function flag() {
    if (!chosen) return;
    await run(
      "Couldn't flag the stat",
      () => flagInjury(chosen, { note: note.trim() || undefined, expectedReturn: back || undefined }),
      `${view.flaggable.find((f) => f.stat === chosen)?.label} flagged.`,
    );
    setBack("");
    setNote("");
  }

  async function clear(s: Stat, label: string) {
    const ok = await confirmDialog({
      title: `Clear the ${label} flag?`,
      message: "Decay and quests for that stat count again from now.",
      confirmLabel: "Clear flag",
    });
    if (ok) await run("Couldn't clear the flag", () => clearInjury(s), `${label} flag cleared.`);
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className={SUBHEAD}>Injuries</h3>
      <p className="text-xs leading-relaxed text-rpg-text-2">
        Flag up to {INJURY.maxStats} stats you&apos;re resting. Quests skip them and their decay freezes. A flag lapses
        after {INJURY.expiryWeeks} weeks unless you renew it.
      </p>

      {view.rows.map((row) => (
        <div key={row.stat} className="flex flex-col gap-1.5 border-t border-rpg-line-soft py-2">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span>{row.label}</span>
            <span className={`text-xs ${row.soon ? "text-rpg-warn" : "text-rpg-muted"}`}>
              Lapses {row.expires}
              {row.soon ? ` (${row.daysToExpiry} ${row.daysToExpiry === 1 ? "day" : "days"})` : ""}
            </span>
          </div>
          {row.expectedReturn && <div className="text-[11px] text-rpg-muted">Back around {row.expectedReturn}</div>}
          {row.note && <div className="break-words text-[11px] text-rpg-muted">Note (private): {row.note}</div>}
          <div className="flex gap-2">
            <button
              onClick={() => void run("Couldn't renew the flag", () => renewInjury(row.stat), `${row.label} flag renewed.`)}
              disabled={off}
              className={`${SECONDARY} flex-1`}
            >
              Renew {INJURY.expiryWeeks} weeks
            </button>
            <button onClick={() => void clear(row.stat, row.label)} disabled={off} className={`${SECONDARY} flex-1`}>
              Clear
            </button>
          </div>
        </div>
      ))}

      {view.full ? (
        <p className="text-[11px] text-rpg-muted">That&apos;s the limit of {INJURY.maxStats}. Clear one to flag another.</p>
      ) : (
        <div className="flex flex-col gap-2 border-t border-rpg-line-soft pt-3">
          <div className="flex flex-col gap-1 text-[11px] text-rpg-muted">
            <span id="flag-stat">Stat</span>
            <div role="group" aria-labelledby="flag-stat" className="grid grid-cols-3 gap-1.5">
              {STATS.map((s) => {
                const free = view.flaggable.some((f) => f.stat === s);
                const picked = free && chosen === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStat(s)}
                    disabled={!free}
                    aria-pressed={picked}
                    className={`min-h-11 border text-[13px] disabled:opacity-40 ${
                      picked
                        ? "border-rpg-accent bg-rpg-accent font-semibold text-rpg-bg"
                        : "border-rpg-line-strong text-rpg-text-2"
                    }`}
                  >
                    {STAT_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-[11px] text-rpg-muted">
            Back around (shown to followers, optional)
            <input type="date" min={today} value={back} onChange={(e) => setBack(e.target.value)} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-rpg-muted">
            Note (private, optional)
            <input
              type="text"
              maxLength={INJURY.maxNoteLength}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={FIELD}
            />
          </label>
          <button onClick={() => void flag()} disabled={off || !chosen} className={PRIMARY}>
            Flag stat
          </button>
        </div>
      )}

      <button
        role="switch"
        aria-checked={view.shown}
        onClick={() => void run("Couldn't change who sees your flags", () => setInjuryVisibility(!view.shown))}
        disabled={off}
        className="flex min-h-11 w-full items-center justify-between gap-3 border-t border-rpg-line-soft py-2 text-left text-[13px] disabled:opacity-40"
      >
        <span className="min-w-0">
          Show injuries to followers
          <span className="block text-[11px] text-rpg-muted">They see the stat and your return date, never the note.</span>
        </span>
        <span
          aria-hidden
          className={`flex h-6 w-6 shrink-0 items-center justify-center border ${
            view.shown ? "border-rpg-accent" : "border-rpg-line-strong"
          }`}
        >
          {view.shown && <span className="h-3 w-3 bg-rpg-accent" />}
        </span>
      </button>
    </div>
  );
}
