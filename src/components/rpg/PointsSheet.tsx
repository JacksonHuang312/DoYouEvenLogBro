"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { BattleView } from "@/lib/game/battleView";
import { LEVEL_POINTS, type Stat } from "@/lib/game/config";
import { Sheet } from "./Sheet";

const STEP = "flex h-11 w-11 shrink-0 items-center justify-center border border-rpg-line-strong text-rpg-text-2 disabled:opacity-40";
const PRIMARY = "min-h-11 w-full bg-rpg-text px-4 text-[13px] font-semibold text-rpg-bg disabled:opacity-40";
const SECONDARY = "min-h-11 w-full border border-rpg-line-strong px-3 text-[13px] text-rpg-text-2 disabled:opacity-40";

/**
 * Spend the stat points levels give (GAME_DESIGN.md 13.3). Each point makes a stat a little
 * stronger in fights only. Plus and minus work on a draft; Apply saves it, and resetting all of
 * them costs coins.
 */
export function PointsSheet({
  points,
  coins,
  busy,
  online,
  onApply,
  onRespec,
  onClose,
}: {
  points: BattleView["points"];
  coins: number;
  busy: boolean;
  online: boolean;
  /** Resolves true when the server took the points, so the draft can clear. */
  onApply: (add: Partial<Record<Stat, number>>) => Promise<boolean>;
  onRespec: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Partial<Record<Stat, number>>>({});
  const drafted = useMemo(() => Object.values(draft).reduce((n, x) => n + (x ?? 0), 0), [draft]);
  const left = points.free - drafted;
  const change = (stat: Stat, by: number) => setDraft((d) => ({ ...d, [stat]: Math.max(0, (d[stat] ?? 0) + by) }));

  return (
    <Sheet title="Stat points" onClose={onClose}>
      <div className="flex flex-col gap-3 px-5 py-4 text-[13px]">
        <p className="text-xs leading-relaxed text-rpg-text-2">
          Each level gives a point. A point makes a stat {LEVEL_POINTS.pctPerPoint * 100}% stronger in fights, up to {points.max} per stat. It never
          changes your radar, Power, quests or boss minimums.
        </p>
        <div className="flex items-baseline justify-between">
          <span>Free points</span>
          <span className="tabular-nums">{left}</span>
        </div>
        <ul className="flex flex-col">
          {points.perStat.map((p) => {
            const d = draft[p.stat] ?? 0;
            const total = p.points + d;
            return (
              <li key={p.stat} className="flex items-center justify-between gap-3 border-t border-rpg-line-soft py-1.5">
                <div className="min-w-0">
                  <div>{p.label}</div>
                  <div className="text-xs text-rpg-muted">
                    {total} {total === 1 ? "point" : "points"} · +{Math.round(total * LEVEL_POINTS.pctPerPoint * 1000) / 10}% in fights
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => change(p.stat, -1)} disabled={busy || d === 0} aria-label={`Take a point back from ${p.label}`} className={STEP}>
                    <Minus size={16} aria-hidden />
                  </button>
                  <button
                    onClick={() => change(p.stat, 1)}
                    disabled={busy || left < 1 || total >= points.max}
                    aria-label={`Add a point to ${p.label}`}
                    className={STEP}
                  >
                    <Plus size={16} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          onClick={async () => {
            if (await onApply(draft)) setDraft({});
          }}
          disabled={busy || !online || drafted === 0}
          className={PRIMARY}
        >
          {drafted > 0 ? `Apply ${drafted} ${drafted === 1 ? "point" : "points"}` : "Apply"}
        </button>
        <button onClick={onRespec} disabled={busy || !online || points.spent === 0 || coins < points.respecCost} className={SECONDARY}>
          Reset all points · {points.respecCost} coins
        </button>
        {points.spent > 0 && coins < points.respecCost && <p className="text-xs text-rpg-muted">Not enough coins to reset.</p>}
        {!online && <p className="text-xs text-rpg-muted">You&apos;re offline.</p>}
      </div>
    </Sheet>
  );
}
