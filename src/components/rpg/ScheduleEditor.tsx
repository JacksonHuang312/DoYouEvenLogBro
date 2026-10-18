"use client";

import Link from "next/link";
import { useState } from "react";
import { errorDialog } from "@/lib/dialog";
import type { ScheduleDoc, WeekdayRoutines } from "@/lib/game/schedule";
import { daysLabel, editableDays, pendingFrom, sameDays, startsOn, toggleDay, WEEKDAYS } from "@/lib/game/questsView";
import { saveSchedule } from "@/lib/gameApi";
import type { Routine } from "@/lib/types";
import { OfflineNote } from "./Disclosure";

const dayName = (id: string) =>
  new Date(`${id}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Pick which weekdays each routine is on. A weekday holds one routine, so tapping a day another
 * routine has moves it. Saving starts the new schedule tomorrow (GAME_DESIGN.md 3.2), so a past
 * day's bonus never changes.
 */
export function ScheduleEditor({
  routines,
  schedule,
  today,
  online,
}: {
  routines: Routine[] | null;
  schedule: ScheduleDoc | null;
  /** Today's day id in the user's time zone. */
  today: string;
  online: boolean;
}) {
  const [draft, setDraft] = useState<WeekdayRoutines | null>(null);
  const [fresh, setFresh] = useState<ScheduleDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  if (!routines) return <p className="text-xs text-rpg-muted">Loading your routines…</p>;
  if (routines.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-rpg-text-2">
        A schedule picks days for your routines.{" "}
        <Link href="/routines/new" className="text-rpg-accent">
          Make a routine
        </Link>{" "}
        first.
      </p>
    );
  }

  // The newest of what the listener has and what the last save returned (the listener can lag a beat).
  const doc = [schedule, fresh].filter((d): d is ScheduleDoc => d != null).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  const base = editableDays(doc, routines.map((r) => r.id));
  const days = draft ?? base;
  const dirty = !sameDays(days, base);
  const waiting = pendingFrom(doc, today);

  async function save() {
    setSaving(true);
    setSaved(null);
    try {
      // Only days whose routine still exists are sent.
      const next = await saveSchedule(days);
      setFresh(next);
      setDraft(null);
      setSaved(`Saved. It starts ${dayName(startsOn(today))}.`);
    } catch (err) {
      void errorDialog("Couldn't save schedule", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="text-xs leading-relaxed text-rpg-text-2">
        Tap the days you train each routine. A change starts tomorrow, so days already gone keep what they were.
      </p>
      {waiting && !dirty && <p className="text-xs text-rpg-muted">A saved change starts {dayName(waiting)}.</p>}

      {routines.map((r) => (
        <div key={r.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate">{r.name}</span>
            <span className="shrink-0 text-xs text-rpg-muted">{daysLabel(days, r.id)}</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={`Days for ${r.name}`}>
            {WEEKDAYS.map((d) => {
              const holder = days[d.key];
              const mine = holder === r.id;
              const other = holder != null && !mine ? routines.find((x) => x.id === holder) : null;
              return (
                <button
                  key={d.key}
                  onClick={() => {
                    setSaved(null);
                    setDraft(toggleDay(days, d.key, r.id));
                  }}
                  aria-pressed={mine}
                  aria-label={`${d.name}${other ? `, now ${other.name}` : ""}`}
                  disabled={saving}
                  className={`min-h-11 border text-[13px] ${
                    mine
                      ? "border-rpg-accent bg-rpg-accent font-semibold text-rpg-bg"
                      : other
                        ? "border-rpg-line text-rpg-muted"
                        : "border-rpg-line-strong text-rpg-text-2"
                  }`}
                >
                  {d.letter}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!online && <OfflineNote what="Schedule changes" />}
      {saved && !dirty && <p className="text-xs text-rpg-good">{saved}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => void save()}
          disabled={!dirty || !online || saving}
          className="min-h-11 flex-1 bg-rpg-text px-4 text-sm font-semibold text-rpg-bg disabled:opacity-40"
        >
          {saving ? "Saving…" : `Save, starts ${dayName(startsOn(today))}`}
        </button>
        {dirty && !saving && (
          <button onClick={() => setDraft(null)} className="min-h-11 border border-rpg-line-strong px-4 text-xs">
            Undo
          </button>
        )}
      </div>
    </>
  );
}
