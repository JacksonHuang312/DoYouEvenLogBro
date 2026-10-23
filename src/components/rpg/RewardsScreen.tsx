"use client";

import { useEffect, useRef } from "react";
import type { RewardsView, Tone } from "@/lib/game/rewards";

const TONE: Record<Tone, string> = { good: "text-rpg-good", warn: "text-rpg-warn", muted: "text-rpg-muted" };
const SECTION = "border-b border-rpg-line px-5 py-4";
const HEADING = "font-rpg-head text-[22px] font-semibold uppercase";

/** A flat progress bar: what was already done, then what this workout added. */
function Bar({ basePct, addedPct, label }: { basePct: number; addedPct: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(basePct + addedPct)}
      className="flex h-1 bg-rpg-line"
    >
      <div className="bg-rpg-accent" style={{ width: `${basePct}%` }} />
      <div className="bg-[#b3d0ff]" style={{ width: `${addedPct}%` }} />
    </div>
  );
}

/**
 * The full-screen Rewards screen after a workout (GAME_DESIGN.md 7.3, design/Rewards.dc.html).
 * Presentation only: <RewardsHost> decides when it opens and rewardsView() decides what it says.
 */
export function RewardsScreen({ view, onDone }: { view: RewardsView; onDone: () => void }) {
  const done = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    done.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Workout rewards" className="fixed inset-0 z-50 overflow-y-auto bg-rpg-bg">
      <div className="mx-auto flex min-h-full max-w-[28rem] flex-col font-rpg-body text-rpg-text">
        <header className="flex flex-col gap-1.5 border-b border-rpg-line px-5 pb-[18px] pt-[max(2rem,env(safe-area-inset-top))]">
          <div className={`text-xs ${TONE[view.header.tone]}`}>{view.header.label}</div>
          <h1 className="break-words font-rpg-head text-[40px] font-bold uppercase leading-[0.95]">{view.title}</h1>
          {view.meta && <div className="text-xs text-rpg-muted">{view.meta}</div>}
        </header>

        {view.notCounted && (
          <section className={`${SECTION} flex flex-col gap-2`}>
            <div className={HEADING}>{view.notCounted.headline}</div>
            <p className="text-[13px] leading-relaxed text-rpg-text-2">{view.notCounted.message}</p>
          </section>
        )}

        {view.coins && (
          <section className={`${SECTION} grid grid-cols-[1fr_auto] gap-y-2 text-[13px]`}>
            {view.coins.rows.map((row) => (
              <div key={row.label} className="contents">
                <span className="text-rpg-muted">{row.label}</span>
                <span className="text-right">{row.value}</span>
              </div>
            ))}
            <span className={HEADING}>Coins</span>
            <span className={`${HEADING} text-right`}>{view.coins.total}</span>
            {view.coins.cap && <span className="col-span-full text-[11px] text-rpg-muted">{view.coins.cap}</span>}
          </section>
        )}

        {view.xp && (
          <section className={`${SECTION} flex flex-col gap-2`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={HEADING}>+{view.xp.gained.toLocaleString("en-US")} XP</span>
              <span className="text-right text-xs text-rpg-muted">{view.xp.label}</span>
            </div>
            <Bar basePct={view.xp.basePct} addedPct={view.xp.addedPct} label="XP toward next level" />
            {view.xp.levelUp && <div className="text-xs text-rpg-accent">{view.xp.levelUp}</div>}
            {view.xp.note && <p className="text-[11px] leading-relaxed text-rpg-muted">{view.xp.note}</p>}
          </section>
        )}

        {view.counted && (
          <section className="flex flex-col px-5 pt-4">
            <h2 className={`${HEADING} pb-1.5`}>Stats</h2>
            {view.calibrating ? (
              <p className="border-t border-rpg-line-soft py-2.5 text-xs leading-relaxed text-rpg-text-2">
                Calibrating. Your stats stay at the starting averages until calibration ends, then change for real.
              </p>
            ) : view.stats.length === 0 ? (
              <p className="border-t border-rpg-line-soft py-2.5 text-xs text-rpg-muted">No stat changes this time.</p>
            ) : (
              view.stats.map((s) => (
                <div
                  key={s.name}
                  className="grid grid-cols-[1fr_auto_56px] gap-2.5 border-t border-rpg-line-soft py-[9px] text-[13px]"
                >
                  <span className="text-rpg-text-2">{s.name}</span>
                  <span className="text-rpg-muted">
                    {s.from} → <span className="text-rpg-text">{s.to}</span>
                  </span>
                  <span className={`text-right ${s.delta.startsWith("+") ? "text-rpg-good" : "text-rpg-bad"}`}>
                    {s.delta}
                  </span>
                </div>
              ))
            )}
            {view.oneRm.map((line) => (
              <div key={line} className="border-t border-rpg-line-soft py-[9px] text-xs text-rpg-warn">
                {line}
              </div>
            ))}
          </section>
        )}

        {view.quests.length > 0 && (
          <section className="flex flex-col gap-4 px-5 pt-4">
            {view.quests.map((q) => (
              <div key={q.id} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-[13px]">
                  <span className="min-w-0 break-words">{q.title}</span>
                  <span className={`shrink-0 ${q.done ? "text-rpg-good" : "text-rpg-muted"}`}>
                    {q.done ? "Done" : q.label}
                  </span>
                </div>
                <Bar basePct={q.basePct} addedPct={q.addedPct} label={`${q.title}: ${q.label}`} />
                {q.reward && <div className="text-[11px] text-rpg-good">{q.reward}</div>}
              </div>
            ))}
          </section>
        )}

        {(view.titles.length > 0 || view.scrap) && (
          <section className="flex flex-col px-5 pt-4">
            {view.titles.map((t) => (
              <p key={t} className="border-t border-rpg-line-soft py-2.5 text-[13px] text-rpg-good">
                {t}
              </p>
            ))}
            {view.scrap && <p className="border-t border-rpg-line-soft py-2.5 text-xs text-rpg-text-2">{view.scrap} from quests</p>}
          </section>
        )}

        <div className="mt-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
          <button ref={done} onClick={onDone} className="min-h-[50px] w-full bg-rpg-text text-sm font-semibold text-rpg-bg">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
