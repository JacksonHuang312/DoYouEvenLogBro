"use client";

import { useEffect, useRef } from "react";
import type { Rarity } from "@/lib/game/config";
import type { ResultView } from "@/lib/game/battleView";
import { RARITY_BORDER, RARITY_TEXT } from "./rarity";

const SECTION = "border-b border-rpg-line px-5 py-4";
const HEADING = "font-rpg-head text-[22px] font-semibold uppercase";
const LABEL: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary", mythic: "Mythic" };
const BIG: Rarity[] = ["epic", "legendary", "mythic"];

/**
 * The full-screen result of a fight (GAME_DESIGN.md 10 and 13.9): the outcome, each round, the
 * rewards, the drops (Epic or better send out one ring in their color, once), and a collapsible
 * timestamped log. Presentation only; resultView() decides what it says.
 */
export function FightResultScreen({ view, onDone }: { view: ResultView; onDone: () => void }) {
  const done = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const rare = view.best && BIG.includes(view.best) ? view.best : null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Fight result" className="fixed inset-0 z-50 overflow-y-auto bg-rpg-bg">
      <div className="mx-auto flex min-h-full max-w-[28rem] flex-col font-rpg-body text-rpg-text">
        <header className="flex flex-col gap-1.5 border-b border-rpg-line px-5 pb-[18px] pt-[max(2rem,env(safe-area-inset-top))]">
          <div className={`text-xs ${view.won ? "text-rpg-good" : "text-rpg-bad"}`}>{view.won ? "You won" : "You lost"}</div>
          <h1 className="font-rpg-head text-[40px] font-bold uppercase leading-[0.95]">{view.headline}</h1>
          <div className="text-xs text-rpg-muted">{view.sub}</div>
        </header>

        <section className={`${SECTION} flex flex-col gap-3`} aria-label="Rounds">
          {view.rounds.map((r, i) => (
            <div key={i} className="flex flex-col gap-0.5 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 break-words font-semibold">{r.title}</span>
                <span className={`shrink-0 text-xs ${r.won ? "text-rpg-good" : "text-rpg-bad"}`}>{r.ended}</span>
              </div>
              <div className="text-xs text-rpg-muted">
                {r.seconds} · power {r.power}
              </div>
            </div>
          ))}
        </section>

        {view.rewards.length > 0 && (
          <section className={`${SECTION} grid grid-cols-[1fr_auto] gap-y-2 text-[13px]`} aria-label="Rewards">
            {view.rewards.map((row) => (
              <div key={row.label} className="contents">
                <span className="text-rpg-text-2">{row.label}</span>
                <span className="text-right tabular-nums">{row.value}</span>
              </div>
            ))}
          </section>
        )}

        {(view.items.length > 0 || view.salvaged.length > 0) && (
          <section className={`${SECTION} flex flex-col gap-3`} aria-label="Drops">
            <div className={HEADING}>{rare ? `${LABEL[rare]} drop` : "Drops"}</div>
            {view.guaranteed && <p className="text-xs text-rpg-warn">Guaranteed: your luck counter paid out.</p>}
            <ul className="flex flex-col gap-2">
              {view.items.map((item) => (
                <li
                  key={item.id}
                  className={`border px-3 py-3 ${RARITY_BORDER[item.rarity]} ${RARITY_TEXT[item.rarity]} ${
                    BIG.includes(item.rarity) ? "rpg-reveal-big" : "rpg-reveal"
                  }`}
                >
                  <div className="text-[15px] font-semibold">{item.name}</div>
                  <div className="text-xs">{LABEL[item.rarity]} · added to your gear</div>
                </li>
              ))}
              {view.salvaged.map((line) => (
                <li key={line} className="text-xs text-rpg-muted">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        )}

        {view.energyLeft != null && <p className="border-b border-rpg-line px-5 py-3 text-xs text-rpg-muted">Fight energy left: {view.energyLeft}</p>}

        <section className={SECTION} aria-label="Fight log">
          {view.log.map((round, i) => (
            <details key={i} className="[&+&]:mt-2">
              <summary className="min-h-11 cursor-pointer py-3 text-[13px] text-rpg-text-2">
                Log{view.log.length > 1 ? `: ${round.title}` : ""} ({round.lines.length} events)
              </summary>
              <ol className="mt-1 flex max-h-72 flex-col gap-1 overflow-y-auto text-xs">
                {round.lines.map((l, j) => (
                  <li key={j} className="grid grid-cols-[3.5rem_1fr] gap-2">
                    <span className="tabular-nums text-rpg-muted">{l.t}</span>
                    <span className="break-words text-rpg-text-2">{l.text}</span>
                  </li>
                ))}
              </ol>
            </details>
          ))}
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
