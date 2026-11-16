"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import type { RaidCardView } from "@/lib/game/raidView";
import { Sheet } from "./Sheet";

const PRIMARY = "min-h-11 w-full bg-rpg-text px-4 text-[13px] font-semibold text-rpg-bg disabled:opacity-40";
const SECONDARY = "min-h-11 border border-rpg-line-strong px-3 text-[13px] text-rpg-text-2 disabled:opacity-40";
const HEADING = "px-5 pt-4 text-xs text-rpg-muted";

/**
 * The raid party sheet (GAME_DESIGN.md 13.32). With no party yet: pick a tier and make one. With a
 * party: who has joined and who was asked, the people the leader can still invite (those who
 * follow each other), and Start. Whether the party may start is the server's call; its reason
 * shows in the usual error dialog.
 */
export function RaidPartySheet({
  view,
  friends,
  busy,
  online,
  onClose,
  onCreate,
  onInvite,
  onKick,
  onTier,
  onStart,
  onCancel,
  onLeave,
}: {
  view: RaidCardView;
  /** People the player and they both follow, or null while loading. */
  friends: { uid: string; name: string }[] | null;
  busy: boolean;
  online: boolean;
  onClose: () => void;
  onCreate: (tier: number) => void;
  onInvite: (uid: string) => void;
  onKick: (uid: string) => void;
  onTier: (tier: number) => void;
  onStart: () => void;
  onCancel: () => void;
  onLeave: () => void;
}) {
  const lobby = view.lobby;
  const off = busy || !online;
  // Making a party starts on the highest tier the player may enter.
  const [picked, setPicked] = useState(view.topTier);
  const tier = lobby?.tier ?? Math.min(Math.max(picked, 1), Math.max(view.topTier, 1));

  const tierList = (current: number, onPick: (tier: number) => void, locked: boolean) => (
    <ul role="radiogroup" aria-label="Raid tier" className="mt-2 border-t border-rpg-line">
      {view.tiers.map((t) => (
        <li key={t.tier} className="border-b border-rpg-line-soft">
          <button
            role="radio"
            aria-checked={t.tier === current}
            disabled={locked}
            onClick={() => onPick(t.tier)}
            className={`flex min-h-12 w-full items-center justify-between gap-3 px-5 text-left text-[13px] disabled:opacity-40 ${t.tier === current ? "text-rpg-text" : "text-rpg-text-2"}`}
          >
            {t.label}
            {t.tier === current && <Check size={16} aria-hidden className="shrink-0 text-rpg-accent" />}
          </button>
        </li>
      ))}
    </ul>
  );

  if (!lobby) {
    return (
      <Sheet title="Raid party" onClose={onClose}>
        <p className="px-5 pt-3 text-xs leading-relaxed text-rpg-text-2">
          Pick a tier, then invite people. Everyone needs the tier&apos;s level and power, and gets one raid a week. You can change the tier
          until you start.
        </p>
        <div className={HEADING}>Tier</div>
        {tierList(tier, setPicked, off)}
        <div className="px-5 pt-4">
          <button onClick={() => onCreate(tier)} disabled={off || view.tiers.length === 0} className={PRIMARY}>
            Make party · {view.boss.name}
          </button>
          {!online && <p className="pt-2 text-xs text-rpg-muted">You&apos;re offline.</p>}
        </div>
      </Sheet>
    );
  }

  const inParty = new Set(lobby.rows.map((r) => r.uid));
  const candidates = friends?.filter((f) => !inParty.has(f.uid)) ?? null;

  return (
    <Sheet title="Raid party" onClose={onClose}>
      <p className="px-5 pt-3 text-[13px]">
        {view.boss.name}
        <span className="block text-xs text-rpg-muted">{lobby.tierLine}</span>
      </p>

      <div className={HEADING}>Party · {lobby.rows.length} of 4</div>
      <ul aria-label="Party" className="mt-2 border-t border-rpg-line">
        {lobby.rows.map((row) => (
          <li key={row.uid} className="flex min-h-12 items-center justify-between gap-3 border-b border-rpg-line-soft px-5">
            <span className="min-w-0 truncate text-[13px]">
              @{row.name}
              {row.you ? " (you)" : ""}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className={`text-xs ${row.role === "Invited" ? "text-rpg-muted" : "text-rpg-good"}`}>{row.role}</span>
              {lobby.isLeader && row.role !== "Leader" && (
                <button onClick={() => onKick(row.uid)} disabled={off} aria-label={`Remove ${row.name}`} className={SECONDARY}>
                  Remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {lobby.isLeader && (
        <>
          <div className={HEADING}>Invite · people you follow who follow you back</div>
          {candidates == null ? (
            <p className="px-5 pt-2 text-xs text-rpg-muted">Loading…</p>
          ) : candidates.length === 0 ? (
            <p className="px-5 pt-2 text-xs leading-relaxed text-rpg-text-2">
              {friends && friends.length > 0 ? "Everyone you could ask is already here." : "Nobody yet. Raids are for people who follow each other: find friends from the avatar menu."}
            </p>
          ) : (
            <ul aria-label="People you can invite" className="mt-2 border-t border-rpg-line">
              {candidates.map((f) => (
                <li key={f.uid} className="flex min-h-12 items-center justify-between gap-3 border-b border-rpg-line-soft px-5">
                  <span className="min-w-0 truncate text-[13px]">@{f.name}</span>
                  <button onClick={() => onInvite(f.uid)} disabled={off || lobby.spots === 0} aria-label={`Invite ${f.name}`} className={SECONDARY}>
                    Invite
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lobby.spots === 0 && <p className="px-5 pt-2 text-xs text-rpg-muted">The party is full.</p>}

          <div className={HEADING}>Tier</div>
          {tierList(lobby.tier, onTier, off)}
        </>
      )}

      <div className="flex flex-col gap-2 px-5 pt-4">
        {lobby.isLeader ? (
          <>
            <button onClick={onStart} disabled={off || !lobby.canStart} className={PRIMARY}>
              Start raid
            </button>
            {lobby.note && <p className="text-xs leading-relaxed text-rpg-muted">{lobby.note}</p>}
            <button onClick={onCancel} disabled={off} className={SECONDARY}>
              Cancel raid
            </button>
          </>
        ) : (
          <>
            {lobby.note && <p className="text-xs leading-relaxed text-rpg-muted">{lobby.note}</p>}
            <button onClick={onLeave} disabled={off} className={SECONDARY}>
              Leave party
            </button>
          </>
        )}
        {!online && <p className="text-xs text-rpg-muted">You&apos;re offline.</p>}
      </div>
    </Sheet>
  );
}
