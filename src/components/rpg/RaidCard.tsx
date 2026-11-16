"use client";

import type { RaidCardView } from "@/lib/game/raidView";
import { EnemyIcon } from "./EnemyIcon";

const PRIMARY = "min-h-11 flex-1 bg-rpg-text px-4 text-[13px] font-semibold text-rpg-bg disabled:opacity-40";
const SECONDARY = "min-h-11 border border-rpg-line-strong px-3 text-[13px] text-rpg-text-2 disabled:opacity-40";

/**
 * The Raid card on the Battle tab (GAME_DESIGN.md 13.32): this week's raid boss, the player's
 * party or invitations, and their last raid. The party itself is managed in the party sheet.
 */
export function RaidCard({
  view,
  busy,
  online,
  onOpenParty,
  onJoin,
  onDecline,
  onOpenResult,
}: {
  view: RaidCardView;
  busy: boolean;
  online: boolean;
  /** Opens the party sheet: the lobby if there is one, else the "make a party" step. */
  onOpenParty: () => void;
  onJoin: (raidId: string) => void;
  onDecline: (raidId: string) => void;
  onOpenResult: (raidId: string) => void;
}) {
  const off = busy || !online;
  const joined = view.lobby?.rows.filter((r) => r.role !== "Invited").length ?? 0;
  const asked = view.lobby?.rows.filter((r) => r.role === "Invited").length ?? 0;

  return (
    <section aria-label="Raid" className="flex flex-col gap-3 border-b border-rpg-line px-5 py-4">
      <div className="flex items-start gap-3">
        <EnemyIcon name={view.boss.name} size={44} />
        <div className="min-w-0">
          <h2 className="font-rpg-head text-2xl font-semibold uppercase leading-none">Raid</h2>
          <p className="mt-2 text-[15px] font-semibold leading-snug">
            {view.boss.name}
            <span className="ml-2 text-xs font-normal text-rpg-muted">{view.boss.type}</span>
          </p>
          <p className="mt-0.5 text-xs italic text-rpg-muted">{view.boss.epithet}</p>
          <p className="mt-1.5 text-xs text-rpg-text-2">{view.boss.note}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-0.5 text-xs text-rpg-muted">
        {view.facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>

      {view.invitations.length > 0 && (
        <ul aria-label="Raid invitations" className="flex flex-col gap-2">
          {view.invitations.map((inv) => (
            <li key={inv.id} className="flex flex-col gap-2 border border-rpg-line-strong p-3">
              <div className="text-[13px]">
                @{inv.leader} asks you to raid
                <span className="block text-xs text-rpg-muted">{inv.line}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onJoin(inv.id)} disabled={off || view.topTier < inv.tier} className={PRIMARY}>
                  Join
                </button>
                <button onClick={() => onDecline(inv.id)} disabled={off} className={SECONDARY}>
                  Decline
                </button>
              </div>
              {view.topTier < inv.tier && <p className="text-xs text-rpg-muted">You don&apos;t have the level or power for tier {inv.tier} yet.</p>}
            </li>
          ))}
        </ul>
      )}

      {view.lobby ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px]">
            {view.lobby.isLeader ? "Your party" : "You're in a party"} · tier {view.lobby.tier} · {joined} joined
            {asked > 0 ? `, ${asked} asked` : ""}
          </p>
          <div className="flex gap-2">
            <button onClick={onOpenParty} aria-haspopup="dialog" className={PRIMARY}>
              Open party
            </button>
          </div>
        </div>
      ) : (
        !view.used &&
        !view.locked &&
        view.tiers.length > 0 && (
          <div className="flex gap-2">
            <button onClick={onOpenParty} disabled={off} aria-haspopup="dialog" className={PRIMARY}>
              Make a party
            </button>
          </div>
        )
      )}

      {view.last && (
        <button onClick={() => onOpenResult(view.last!.id)} className={`${SECONDARY} text-left`}>
          <span className={view.last.won ? "text-rpg-good" : "text-rpg-bad"}>Last raid</span> · {view.last.line}
        </button>
      )}

      {!online && <p className="text-xs text-rpg-muted">You&apos;re offline.</p>}
      {online && view.locked && <p className="text-xs text-rpg-muted">{view.locked}</p>}
    </section>
  );
}
