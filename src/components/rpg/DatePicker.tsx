"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { monthGrid, monthInRange, monthLabel, monthStart, shiftMonth } from "@/lib/game/calendar";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const shown = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * A flat date field: a 44px row showing the date, opening a Sunday-first month grid inline under
 * it. The value is yyyy-mm-dd, or "" for none. Days before `min` or after `max` can't be picked.
 */
export function DatePicker({
  label,
  value,
  onChange,
  today,
  min,
  max,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (day: string) => void;
  today: string;
  min: string;
  max: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthStart(value || today));
  const panel = useId();
  const labelId = useId();

  const grid = monthGrid(month, { today, min, max, selected: value || null });
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  function toggle() {
    if (!open) setMonth(monthStart(value || today));
    setOpen(!open);
  }

  function pick(day: string) {
    onChange(day);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1 text-[11px] text-rpg-muted">
      <span id={labelId}>{label}</span>
      <button
        onClick={toggle}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panel}
        aria-labelledby={labelId}
        className={`flex min-h-11 w-full items-center justify-between gap-3 border px-3 text-left text-[13px] disabled:opacity-40 ${
          open ? "border-rpg-accent" : "border-rpg-line-strong"
        } ${value ? "text-rpg-text" : "text-rpg-muted"}`}
      >
        {value ? shown(value) : "No date"}
        <span className="text-[11px] text-rpg-muted">{open ? "Close" : "Pick"}</span>
      </button>

      {open && (
        <div id={panel} className="flex flex-col border border-rpg-line-strong text-[13px] text-rpg-text">
          <div className="flex items-center justify-between border-b border-rpg-line">
            <button
              onClick={() => setMonth(prev)}
              disabled={!monthInRange(prev, min, max)}
              aria-label="Previous month"
              className="flex h-11 w-11 items-center justify-center text-rpg-text-2 disabled:opacity-30"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <span aria-live="polite" className="font-rpg-head text-base font-semibold uppercase">
              {monthLabel(month)}
            </span>
            <button
              onClick={() => setMonth(next)}
              disabled={!monthInRange(next, min, max)}
              aria-label="Next month"
              className="flex h-11 w-11 items-center justify-center text-rpg-text-2 disabled:opacity-30"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 p-1.5" role="group" aria-label={monthLabel(month)}>
            {WEEKDAY_LETTERS.map((l, i) => (
              <div key={i} aria-hidden className="py-1 text-center text-[11px] text-rpg-muted">
                {l}
              </div>
            ))}
            {grid.flat().map((cell, i) =>
              cell ? (
                <button
                  key={cell.day}
                  onClick={() => pick(cell.day)}
                  disabled={cell.disabled}
                  aria-pressed={cell.selected}
                  aria-label={shown(cell.day) + (cell.today ? ", today" : "")}
                  className={`min-h-11 border text-[13px] disabled:opacity-30 ${
                    cell.selected
                      ? "border-rpg-accent bg-rpg-accent font-semibold text-rpg-bg"
                      : cell.today
                        ? "border-rpg-text-2 text-rpg-text"
                        : "border-transparent text-rpg-text-2"
                  }`}
                >
                  {cell.date}
                </button>
              ) : (
                <div key={`blank-${i}`} aria-hidden />
              ),
            )}
          </div>

          <button
            onClick={() => pick("")}
            disabled={!value}
            className="min-h-11 border-t border-rpg-line text-xs text-rpg-text-2 disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
