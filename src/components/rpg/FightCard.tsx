"use client";

import { useState } from "react";
import { ENDLESS_TOWER } from "@/lib/game/config";
import { EnemyIcon } from "./EnemyIcon";
import type { ModeCard } from "@/lib/game/battleView";

const PRIMARY = "min-h-11 flex-1 bg-rpg-text px-4 text-[13px] font-semibold text-rpg-bg disabled:opacity-40";
const SECONDARY = "min-h-11 flex-1 border border-rpg-line-strong px-3 text-[13px] text-rpg-text-2 disabled:opacity-40";

/**
 * One fight mode: the next enemy, how your power compares, the stat minimums, and the Fight
 * button. Whether the button is on, and why not, comes from the server's own rules (battleView).
 */
export function FightCard({
  card,
  busy,
  online,
  onFight,
}: {
  card: ModeCard;
  busy: boolean;
  online: boolean;
  onFight: (opts: { floor?: number; climb?: boolean }) => void;
}) {
  const reclearable = card.floors.filter((f) => f.reclear);
  const next = card.floors.find((f) => !f.reclear);
  const [floor, setFloor] = useState<number | null>(null);
  const picked = floor != null && card.floors.some((f) => f.floor === floor) ? floor : (next?.floor ?? card.floors.at(-1)?.floor ?? null);
  const off = busy || !online || !card.enabled;
  const unmet = card.minimums.filter((m) => !m.met && !m.waived);

  return (
    <section aria-label={card.title} className="flex flex-col gap-3 border-b border-rpg-line px-5 py-4">
      <div className="flex items-start gap-3">
        <EnemyIcon name={card.foe} size={44} />
        <div className="min-w-0">
          <h2 className="font-rpg-head text-2xl font-semibold uppercase leading-none">{card.title}</h2>
          <p className="mt-2 text-[15px] font-semibold leading-snug">
            {card.foe}
            {card.type && <span className="ml-2 text-xs font-normal text-rpg-muted">{card.type}</span>}
          </p>
          {card.epithet && <p className="mt-0.5 text-xs italic text-rpg-muted">{card.epithet}</p>}
          <p className="mt-1.5 text-xs text-rpg-text-2">{card.powerLine}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-0.5 text-xs text-rpg-muted">
        {card.facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>

      {card.minimums.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-rpg-muted">Stat minimums</div>
          <ul className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-[13px]">
            {card.minimums.map((m) => (
              <li key={m.stat} className="contents">
                <span>{m.label}</span>
                <span className="text-right tabular-nums text-rpg-text-2">
                  {m.have} / {m.needed}
                </span>
                <span className={`w-14 text-right text-xs ${m.met ? "text-rpg-good" : m.waived ? "text-rpg-muted" : "text-rpg-bad"}`}>
                  {m.met ? "met" : m.waived ? "injured" : "short"}
                </span>
              </li>
            ))}
          </ul>
          {unmet.length > 0 && <p className="text-xs text-rpg-muted">Short on a minimum? You can still fight with 20% more power than the boss.</p>}
        </div>
      )}

      {card.mode === "bossTower" && card.floors.length > 1 && (
        <label className="flex flex-col gap-1 text-xs text-rpg-muted">
          Floor
          <span className="flex items-center gap-3">
            <EnemyIcon name={card.floors.find((f) => f.floor === picked)?.boss ?? card.foe} size={32} />
            <select
              value={picked ?? ""}
              onChange={(e) => setFloor(Number(e.target.value))}
              className="min-h-11 min-w-0 flex-1 border border-rpg-line-strong bg-rpg-bg px-3 text-[13px] text-rpg-text"
            >
              {card.floors.map((f) => (
                <option key={f.floor} value={f.floor}>
                  {f.floor}. {f.boss}
                  {f.reclear ? " (cleared, pays gold only)" : " (next)"}
                </option>
              ))}
            </select>
          </span>
        </label>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onFight(card.mode === "bossTower" && picked != null ? { floor: picked } : {})}
          disabled={off}
          className={PRIMARY}
        >
          {card.mode === "bossTower" && reclearable.some((f) => f.floor === picked) ? "Reclear floor" : "Fight"}
          {card.energy > 0 ? ` · ${card.energy} energy` : ""}
        </button>
        {card.mode === "endless" && (
          <button onClick={() => onFight({ climb: true })} disabled={busy || !online || !card.canClimb} className={SECONDARY}>
            Climb up to {ENDLESS_TOWER.autoClimbMax}
          </button>
        )}
      </div>
      {!online && <p className="text-xs text-rpg-muted">You&apos;re offline.</p>}
      {online && card.reason && <p className="text-xs text-rpg-muted">{card.reason}</p>}
    </section>
  );
}
