"use client";

import { useEffect, useRef } from "react";
import type { RaidResultView } from "@/lib/game/raidView";
import { EnemyIcon } from "./EnemyIcon";
import { RARITY_TEXT } from "./rarity";

const SECTION = "border-b border-rpg-line px-5 py-4";

/**
 * The full-screen result of a raid (GAME_DESIGN.md 13.32): the outcome, each member's damage,
 * absorbed and healing with what they were paid, and the timestamped log. Presentation only;
 * raidResultView() decides what it says. There is no raid replay yet.
 */
export function RaidResultScreen({ view, onDone }: { view: RaidResultView; onDone: () => void }) {
  const done = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Raid result" className="rpg-fade fixed inset-0 z-50 overflow-y-auto bg-rpg-bg lg:pl-64">
      <div className="mx-auto flex min-h-full max-w-[28rem] flex-col font-rpg-body text-rpg-text">
        <header className="flex flex-col gap-1.5 border-b border-rpg-line px-5 pb-[18px] pt-[max(2rem,env(safe-area-inset-top))]">
          <div className={`text-xs ${view.won ? "text-rpg-good" : "text-rpg-bad"}`}>{view.won ? "Your party won" : "Your party lost"}</div>
          <h1 className="font-rpg-head text-[40px] font-bold uppercase leading-[0.95]">{view.headline}</h1>
          <div className="text-xs text-rpg-muted">{view.sub}</div>
        </header>

        <section className={`${SECTION} flex items-start gap-3 text-[13px]`} aria-label="Boss">
          <EnemyIcon name={view.boss} size={44} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="break-words font-semibold">{view.boss}</span>
            <span className={`text-xs ${view.won ? "text-rpg-good" : "text-rpg-bad"}`}>{view.ended}</span>
          </div>
        </section>

        <section className={SECTION} aria-label="Party">
          <ul className="flex flex-col gap-4">
            {view.rows.map((row) => (
              <li key={row.uid} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`min-w-0 break-words text-[15px] font-semibold ${row.you ? "text-rpg-accent" : ""}`}>{row.name}</span>
                  <span className={`shrink-0 text-xs ${row.down ? "text-rpg-bad" : "text-rpg-text-2"}`}>{row.status}</span>
                </div>
                <div className="text-xs text-rpg-muted">{row.detail}</div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {(
                    [
                      ["Damage", row.dealt],
                      ["Absorbed", row.absorbed],
                      ["Healing", row.healed],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="border border-rpg-line-soft py-1.5">
                      <dt className="text-[11px] text-rpg-muted">{label}</dt>
                      <dd className="font-rpg-head text-xl font-semibold tabular-nums leading-tight">{value}</dd>
                    </div>
                  ))}
                </dl>
                {row.pay && <div className="text-xs text-rpg-text-2">{row.pay}</div>}
                {row.loot && <div className={`break-words text-xs ${row.loot.rarity ? `${RARITY_TEXT[row.loot.rarity]} rpg-reveal` : "text-rpg-muted"}`}>{row.loot.text}</div>}
              </li>
            ))}
          </ul>
        </section>

        <section className={SECTION} aria-label="Raid log">
          <details>
            <summary className="min-h-11 cursor-pointer py-3 text-[13px] text-rpg-text-2">Log ({view.log.length} events)</summary>
            <ol className="mt-1 flex max-h-72 flex-col gap-1 overflow-y-auto text-xs">
              {view.log.map((l, j) => (
                <li key={j} className="grid grid-cols-[3.5rem_1fr] gap-2">
                  <span className="tabular-nums text-rpg-muted">{l.t}</span>
                  <span className="break-words text-rpg-text-2">{l.text}</span>
                </li>
              ))}
            </ol>
          </details>
        </section>

        <div className="sticky bottom-0 mt-auto bg-rpg-bg px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button ref={done} onClick={onDone} className="min-h-11 w-full bg-rpg-text px-4 text-[13px] font-semibold text-rpg-bg">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
