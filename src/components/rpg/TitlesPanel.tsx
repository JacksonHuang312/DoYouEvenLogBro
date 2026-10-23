"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameState } from "@/lib/game/claim";
import { titlesView, toggledTitles } from "@/lib/game/itemsView";
import { TITLE_INFO, type AchievementProgress, type TitleId } from "@/lib/game/titles";
import { buyTitleSlot, checkTitles, equipTitles } from "@/lib/gameApi";
import { confirmRpgDialog } from "@/lib/rpgDialog";
import { useRunner } from "@/lib/useRunner";
import { OfflineNote } from "./Disclosure";

const number = (n: number) => n.toLocaleString("en-US");
const HEADING = "font-rpg-head text-xl font-semibold uppercase tracking-[0.02em]";

/**
 * Hero · Titles: the equipped titles and their slots, and the eight achievements with progress.
 * Opening the tab asks the server to check the achievements (which records any newly earned
 * title); equipping and buying a slot are server calls too.
 */
export function TitlesPanel({ state, online }: { state: GameState | null; online: boolean }) {
  const [progress, setProgress] = useState<Record<TitleId, AchievementProgress> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, run } = useRunner();

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    checkTitles()
      .then((res) => {
        if (cancelled) return;
        setProgress(res.progress);
        setLoadFailed(false);
        if (res.earned.length > 0) setNotice(`Title earned: ${res.earned.map((id) => TITLE_INFO[id].name).join(", ")}.`);
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [online]);

  const view = useMemo(() => titlesView(state, progress), [state, progress]);
  const off = busy || !online;

  async function toggle(id: TitleId) {
    const next = toggledTitles(state, id);
    if (!next.ok) return;
    const res = await run("Couldn't change your titles", () => equipTitles(next.titles));
    if (res) setProgress(res.progress);
  }

  async function buySlot() {
    const next = view.slots.next;
    if (!next) return;
    const ok = await confirmRpgDialog({
      title: "Buy a title slot?",
      message: `Slot ${view.slots.total + 1} of ${view.slots.max} costs ${number(next.cost)} coins. You have ${number(state?.coins ?? 0)}. Each title you wear adds a few percent to battle power.`,
      confirmLabel: `Buy for ${number(next.cost)}`,
    });
    if (!ok) return;
    const res = await run("Couldn't buy the slot", () => buyTitleSlot(view.slots.total));
    if (res) setProgress(res.progress);
  }

  return (
    <>
      <section className="px-5 pt-3">
        <div className="flex items-baseline justify-between">
          <h2 className={HEADING}>Slots</h2>
          <span className="text-xs text-rpg-text-2">
            {view.slots.used} of {view.slots.total} used · {view.bonus} battle power
          </span>
        </div>
        <p className="pt-1 text-[11px] leading-relaxed text-rpg-muted">{view.bucketNote}</p>
        {!online && (
          <div className="pt-2">
            <OfflineNote what="Changing titles and buying slots" />
          </div>
        )}
        {view.slots.next ? (
          <div className="flex flex-col gap-1 pt-3">
            <button
              onClick={() => void buySlot()}
              disabled={off || !view.slots.next.enabled}
              className="min-h-11 border border-rpg-line-strong px-3 text-[13px] text-rpg-text-2 disabled:opacity-40"
            >
              Buy slot {view.slots.total + 1} · {number(view.slots.next.cost)} coins
            </button>
            {view.slots.next.reason && <p className="text-[11px] text-rpg-muted">{view.slots.next.reason}</p>}
          </div>
        ) : (
          <p className="pt-2 text-[11px] text-rpg-muted">All {view.slots.max} slots unlocked.</p>
        )}
        {notice && (
          <p role="status" className="pt-2 text-xs text-rpg-good">
            {notice}
          </p>
        )}
      </section>

      <section className="px-5 pt-4">
        <h2 className={HEADING}>Achievements</h2>
        {loadFailed && !progress && (
          <p className="pt-1 text-[11px] text-rpg-warn">Couldn&apos;t check your progress right now. Earned titles still show.</p>
        )}
        {!online && !progress && <p className="pt-1 text-[11px] text-rpg-muted">Progress shows when you&apos;re online.</p>}
        <ul className="mt-1 border-t border-rpg-line">
          {view.rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-1.5 border-b border-rpg-line-soft py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-rpg-head text-lg font-semibold uppercase leading-tight">{r.name}</span>
                    <span className="text-xs text-rpg-accent">{r.bonus}</span>
                    {r.equipped && <span className="text-[11px] text-rpg-good">Equipped</span>}
                  </span>
                  <span className="text-xs text-rpg-text-2">{r.description}</span>
                </div>
                {r.action && (
                  <button
                    onClick={() => void toggle(r.id)}
                    disabled={off || !r.action.enabled}
                    className={`min-h-11 shrink-0 border px-3 text-[13px] disabled:opacity-40 ${
                      r.action.label === "Equip" ? "border-rpg-text bg-rpg-text font-semibold text-rpg-bg" : "border-rpg-line-strong text-rpg-text-2"
                    }`}
                  >
                    {r.action.label}
                  </button>
                )}
              </div>
              {r.fraction != null && (
                <div
                  role="progressbar"
                  aria-label={`${r.name} progress`}
                  aria-valuenow={Math.round(r.fraction * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1 bg-rpg-line"
                >
                  <div className={`h-full ${r.earned ? "bg-rpg-good" : "bg-rpg-accent"}`} style={{ width: `${r.fraction * 100}%` }} />
                </div>
              )}
              <div className="flex justify-between gap-3 text-[11px]">
                <span className={r.earned ? "text-rpg-good" : "text-rpg-muted"}>{r.progress ?? "Progress unavailable"}</span>
                {r.action?.reason && <span className="text-right text-rpg-muted">{r.action.reason}</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
