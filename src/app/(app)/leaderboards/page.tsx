"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { RpgScreen, Skeleton } from "@/components/rpg/RpgScreen";
import { TabHeader } from "@/components/rpg/TabHeader";
import { Avatar } from "@/components/ui";
import { BOARD_TEXT, boardRows, BOARDS, type BoardEntry, type BoardId } from "@/lib/game/boards";
import { fightWeek } from "@/lib/game/fights";
import { profilePath, useFollowingUids, useProfiles } from "@/lib/follows";
import { BOARD_PLAYERS, useBoards } from "@/lib/useGame";

/**
 * Friend leaderboards (GAME_DESIGN.md 6 and 13.27): you and everyone you follow, on one board at a
 * time. There is no global board. The numbers are read once when the page opens.
 */
export default function LeaderboardsPage() {
  const profile = useProfile();
  const following = useFollowingUids(profile.uid);
  const [board, setBoard] = useState<BoardId>("power");
  const [week] = useState(() => fightWeek(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone));

  const uids = useMemo(() => (following ? [profile.uid, ...following.filter((u) => u !== profile.uid)].slice(0, BOARD_PLAYERS) : null), [following, profile.uid]);
  const profiles = useProfiles(uids);
  const boards = useBoards(uids);

  const rows = useMemo(() => {
    if (!profiles || !boards) return null;
    const entries: BoardEntry[] = profiles.map((p) => ({ uid: p.uid, name: p.username, photoURL: p.photoURL, board: boards[p.uid] ?? null }));
    return boardRows(entries, board, profile.uid, week);
  }, [profiles, boards, board, profile.uid, week]);

  const friends = following?.length ?? 0;

  return (
    <RpgScreen>
      <TabHeader kicker={following ? `You and ${friends} ${friends === 1 ? "person" : "people"} you follow` : <Skeleton className="h-3 w-40" />} title="Leaderboards" />

      <div role="tablist" aria-label="Board" className="grid grid-cols-4 border-b border-rpg-line">
        {BOARDS.map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={board === id}
            onClick={() => setBoard(id)}
            className={`min-h-11 border-b-2 px-1 text-[13px] ${board === id ? "border-rpg-accent text-rpg-text" : "border-transparent text-rpg-muted"}`}
          >
            {BOARD_TEXT[id].label}
          </button>
        ))}
      </div>

      <section role="tabpanel" aria-label={BOARD_TEXT[board].label} className="px-5 pb-6">
        <p className="py-3 text-xs leading-relaxed text-rpg-text-2">
          {BOARD_TEXT[board].note}
          {BOARD_TEXT[board].weekly ? " Resets Sunday at 4 AM." : ""}
        </p>
        {!rows ? (
          <div aria-busy="true" aria-label="Loading the board" className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ol className="border-t border-rpg-line">
            {rows.map((row) => (
              <li key={row.uid} className="border-b border-rpg-line-soft">
                <Link
                  href={row.isYou ? "/profile" : profilePath(row.uid)}
                  className={`flex min-h-[56px] items-center gap-3 py-2 ${row.isYou ? "text-rpg-accent" : ""}`}
                >
                  <span className="w-7 shrink-0 text-center font-rpg-head text-xl font-semibold tabular-nums text-rpg-text-2">
                    {row.rank ?? "–"}
                  </span>
                  <Avatar photoURL={row.photoURL} name={row.name} size={32} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm">
                      @{row.name}
                      {row.isYou ? " (you)" : ""}
                    </span>
                    {row.detail && <span className="truncate text-[11px] text-rpg-muted">{row.detail}</span>}
                  </span>
                  <span className={`shrink-0 font-rpg-head text-2xl font-semibold tabular-nums ${row.value == null ? "text-rpg-muted" : "text-rpg-text"}`}>
                    {row.text}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
        {rows && friends === 0 && (
          <p className="pt-4 text-xs leading-relaxed text-rpg-text-2">
            It&apos;s just you so far.{" "}
            <Link href="/search" className="inline-flex min-h-11 items-center text-rpg-accent">
              Find friends
            </Link>{" "}
            to see them here.
          </p>
        )}
        {rows && rows.some((r) => r.value == null) && (
          <p className="pt-3 text-[11px] leading-relaxed text-rpg-muted">
            A dash means no number yet{BOARD_TEXT[board].weekly ? " this week" : ""}, or a private account that hasn&apos;t accepted your follow.
          </p>
        )}
      </section>
    </RpgScreen>
  );
}
