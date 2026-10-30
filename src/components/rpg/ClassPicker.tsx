"use client";

import { CLASS_SWITCH, type ClassId } from "@/lib/game/config";
import type { ClassCard } from "@/lib/game/battleView";

/**
 * The three classes as tappable cards. `current` marks the one you have (a switch), none for the
 * free first pick. Presentation only; the caller confirms and calls the server.
 */
export function ClassPicker({
  classes,
  current,
  disabled,
  onPick,
}: {
  classes: ClassCard[];
  current: ClassId | null;
  disabled: boolean;
  onPick: (id: ClassId) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {classes.map((c) => {
        const here = c.id === current;
        return (
          <li key={c.id}>
            <button
              onClick={() => onPick(c.id)}
              disabled={disabled || here}
              aria-label={here ? `${c.name}, your class` : `${current ? "Switch to" : "Become a"} ${c.name}`}
              className="flex min-h-11 w-full flex-col gap-1 border border-rpg-line-strong px-3 py-3 text-left disabled:opacity-60"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-rpg-head text-xl font-semibold uppercase leading-none">{c.name}</span>
                <span className="text-xs text-rpg-muted">{here ? "Your class" : current ? `${CLASS_SWITCH.cost} coins` : "Free"}</span>
              </span>
              <span className="text-xs leading-relaxed text-rpg-text-2">{c.blurb}</span>
              <span className="text-xs text-rpg-muted">
                Skill: {c.skill} · Ultimate: {c.ultimate}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
