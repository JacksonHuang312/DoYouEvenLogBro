"use client";

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { FIGHT_HISTORY, historyView } from "@/lib/game/battleView";
import { useFightHistory, type StoredFight } from "@/lib/useGame";
import { EnemyIcon } from "./EnemyIcon";
import { Skeleton } from "./RpgScreen";
import { Sheet } from "./Sheet";

/**
 * Battle · History (GAME_DESIGN.md 13.22): the last fights, newest first. A row opens that fight's
 * result screen, with its log and Watch replay. Read straight from the stored fight records, and
 * only while the sheet is open.
 */
export function FightHistorySheet({
  uid,
  now,
  timeZone,
  onOpen,
  onClose,
}: {
  uid: string;
  now: number;
  timeZone: string;
  onOpen: (fight: StoredFight) => void;
  onClose: () => void;
}) {
  const fights = useFightHistory(uid);
  const rows = useMemo(
    () => historyView(fights.data, now, timeZone),
    [fights.data, now, timeZone],
  );

  return (
    <Sheet title="History" onClose={onClose}>
      {fights.status === "unavailable" ? (
        <p className="px-5 py-8 text-sm text-rpg-text-2">
          Can&apos;t load your fights right now. They&apos;ll show here once
          you&apos;re back online.
        </p>
      ) : fights.status === "loading" ? (
        <div
          aria-busy="true"
          aria-label="Loading fights"
          className="flex flex-col gap-3 px-5 py-4"
        >
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-sm leading-relaxed text-rpg-text-2">
          No fights yet. Your fights show here once you&apos;ve had one.
        </p>
      ) : (
        <>
          <ul aria-label="Past fights">
            {rows.map((row) => (
              <li key={row.id} className="border-b border-rpg-line-soft">
                <button
                  onClick={() => {
                    const fight = fights.data.find((f) => f.id === row.id);
                    if (fight) onOpen(fight);
                  }}
                  className="flex min-h-[60px] w-full items-center gap-3 px-5 py-2.5 text-left"
                >
                  <EnemyIcon name={row.foe} size={32} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className={`font-rpg-head text-lg font-semibold uppercase leading-tight ${row.won ? "text-rpg-good" : "text-rpg-bad"}`}
                      >
                        {row.headline}
                      </span>
                      <span className="shrink-0 text-[11px] text-rpg-muted">
                        {row.when}
                      </span>
                    </span>
                    <span className="break-words text-xs text-rpg-text-2">
                      {row.sub}
                    </span>
                    <span className="break-words text-[11px] text-rpg-muted">
                      {row.loot}
                    </span>
                  </span>
                  <ChevronRight
                    size={14}
                    aria-hidden
                    className="shrink-0 text-rpg-muted"
                  />
                </button>
              </li>
            ))}
          </ul>
          <p className="px-5 pt-3 text-[11px] text-rpg-muted">
            Your last {FIGHT_HISTORY} fights.
          </p>
        </>
      )}
    </Sheet>
  );
}
