"use client";

import { useMemo, useRef, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { ClassPicker } from "@/components/rpg/ClassPicker";
import { FightCard } from "@/components/rpg/FightCard";
import { FightHistorySheet } from "@/components/rpg/FightHistorySheet";
import { FightReplay } from "@/components/rpg/FightReplay";
import { FightResultScreen } from "@/components/rpg/FightResultScreen";
import { PointsSheet } from "@/components/rpg/PointsSheet";
import { RaidCard } from "@/components/rpg/RaidCard";
import { RaidPartySheet } from "@/components/rpg/RaidPartySheet";
import { RaidResultScreen } from "@/components/rpg/RaidResultScreen";
import { RpgScreen, Skeleton } from "@/components/rpg/RpgScreen";
import { Sheet } from "@/components/rpg/Sheet";
import { TabHeader } from "@/components/rpg/TabHeader";
import { battleView, resultView, type ResultView } from "@/lib/game/battleView";
import { CLASS_SWITCH, CLASSES, type ClassId } from "@/lib/game/config";
import type { FightMode } from "@/lib/game/fights";
import type { RaidRecord } from "@/lib/game/raidLobby";
import { raidCardView, raidResultView } from "@/lib/game/raidView";
import {
  useFollowerUids,
  useFollowingUids,
  useProfiles,
} from "@/lib/follows";
import { combineStatus, resolveTimeZone } from "@/lib/game/view";
import {
  assignStatPoints,
  cancelRaid,
  createRaid,
  fight,
  inviteToRaid,
  joinRaid,
  kickFromRaid,
  leaveRaid,
  pickClass,
  respecStatPoints,
  setRaidTier,
  startRaid,
  switchClass,
} from "@/lib/gameApi";
import { confirmRpgDialog } from "@/lib/rpgDialog";
import {
  useBattleDoc,
  useGameState,
  useInventory,
  useMuscleFacts,
  useRaids,
} from "@/lib/useGame";
import { useNow } from "@/lib/useNow";
import { useOnline } from "@/lib/useOnline";
import { useRunner } from "@/lib/useRunner";

const SECONDARY =
  "min-h-11 flex-1 border border-rpg-line-strong px-3 text-[13px] text-rpg-text-2 disabled:opacity-40";
const HEADING = "font-rpg-head text-2xl font-semibold uppercase leading-none";

/** Battle: the four fight modes, fight energy, class and stat points (GAME_DESIGN.md 7.2, 10 and 13). */
export default function BattlePage() {
  const profile = useProfile();
  const state = useGameState(profile.uid);
  const battle = useBattleDoc(profile.uid);
  const muscles = useMuscleFacts(profile.uid);
  const inventory = useInventory(profile.uid);
  const online = useOnline();
  const now = useNow(state.data?.updatedAt);
  const { busy, run } = useRunner();
  const status = combineStatus(
    state.status,
    battle.status,
    muscles.status,
    inventory.status,
  );
  const [result, setResult] = useState<ResultView | null>(null);
  // A new fight plays its replay first (skippable); the result screen can replay it again.
  const [replaying, setReplaying] = useState(false);
  const [sheet, setSheet] = useState<
    "class" | "points" | "history" | "raid" | null
  >(null);
  // A fought raid being looked at: the one just started, or the last one, opened from the card.
  const [raidResult, setRaidResult] = useState<RaidRecord | null>(null);
  // A raid result opened from History goes back to the list when it closes.
  const [raidFromHistory, setRaidFromHistory] = useState(false);
  const raids = useRaids(profile.uid);
  const following = useFollowingUids(profile.uid);
  const followers = useFollowerUids(profile.uid);
  // Raids are for people who follow each other.
  const mutualUids = useMemo(
    () =>
      following && followers
        ? following.filter((u) => followers.includes(u))
        : null,
    [following, followers],
  );
  const friendProfiles = useProfiles(sheet === "raid" ? mutualUids : null);
  const friends = useMemo(
    () => friendProfiles?.map((p) => ({ uid: p.uid, name: p.username })) ?? null,
    [friendProfiles],
  );
  // A result opened from History goes back to the list when it closes.
  const [fromHistory, setFromHistory] = useState(false);
  // A request id lives until its fight comes back, so a retry after a dropped connection returns that same fight.
  const pending = useRef(new Map<string, string>());

  const view = useMemo(
    () =>
      status === "ready"
        ? battleView({
            state: state.data,
            battle: battle.data,
            muscles: muscles.data,
            inventory: inventory.data,
            now,
            timeZone: resolveTimeZone(
              state.data,
              Intl.DateTimeFormat().resolvedOptions().timeZone,
            ),
          })
        : null,
    [status, state.data, battle.data, muscles.data, inventory.data, now],
  );

  const timeZone = resolveTimeZone(
    state.data,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const raid = useMemo(
    () =>
      view?.classId && state.data
        ? raidCardView({
            uid: profile.uid,
            level: state.data.level,
            power: view.power,
            lastRaidWeek: battle.data?.raid?.weekId,
            raids: raids.data,
            now,
            timeZone,
          })
        : null,
    [view, state.data, battle.data, raids.data, now, timeZone, profile.uid],
  );

  /** Runs a raid action; the party sheet and card follow the live document. */
  const raidDo = (title: string, action: () => Promise<unknown>) =>
    void run(title, action);

  async function beginRaid() {
    const lobby = raid?.lobby;
    if (!lobby) return;
    const ok = await confirmRpgDialog({
      title: "Start the raid?",
      message:
        "It is fought once, now, with everyone who has joined. It uses this week's raid for all of you, win or lose.",
      confirmLabel: "Start raid",
    });
    if (!ok) return;
    const res = await run("Couldn't start the raid", () => startRaid(lobby.id));
    if (res?.raid.outcome) {
      // The sheet is in the top layer, above the result screen, so it closes first.
      setSheet(null);
      setRaidResult(res.raid.outcome);
    }
  }

  async function endRaid(kind: "cancel" | "leave") {
    const lobby = raid?.lobby;
    if (!lobby) return;
    const ok = await confirmRpgDialog({
      title: kind === "cancel" ? "Cancel the raid?" : "Leave the party?",
      message:
        kind === "cancel"
          ? "The party is closed for everyone. You can make a new one this week."
          : "The leader can invite you again.",
      confirmLabel: kind === "cancel" ? "Cancel raid" : "Leave",
      destructive: true,
    });
    if (!ok) return;
    const res = await run(
      kind === "cancel" ? "Couldn't cancel the raid" : "Couldn't leave",
      () => (kind === "cancel" ? cancelRaid(lobby.id) : leaveRaid(lobby.id)),
    );
    if (res) setSheet(null);
  }

  async function go(
    mode: FightMode,
    opts: { floor?: number; climb?: boolean },
  ) {
    // Settings can turn the two confirmations off (13.23).
    if (
      !profile.skipFightConfirm &&
      (mode === "weekly" || mode === "bossTower")
    ) {
      const ok = await confirmRpgDialog({
        title:
          mode === "weekly"
            ? "Fight the weekly boss?"
            : "Fight the Boss Tower?",
        message:
          mode === "weekly"
            ? "You get one fight a day, win or lose."
            : "The Boss Tower closes for 4 hours after any fight, win or lose.",
        confirmLabel: "Fight",
      });
      if (!ok) return;
    }
    const key = `${mode}:${opts.floor ?? ""}:${opts.climb ? "climb" : ""}`;
    const requestId = pending.current.get(key) ?? crypto.randomUUID();
    pending.current.set(key, requestId);
    const res = await run("Couldn't fight", () =>
      fight({ mode, requestId, ...opts }),
    );
    if (!res) return;
    pending.current.delete(key);
    const next = resultView(res.fight, res.energy);
    setFromHistory(false);
    setResult(next);
    setReplaying(
      next.replay != null &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }

  async function choose(id: ClassId) {
    const switching = !!view?.classId;
    const ok = await confirmRpgDialog({
      title: switching
        ? `Switch to ${CLASSES[id].name}?`
        : `Become a ${CLASSES[id].name}?`,
      message: switching
        ? `It costs ${CLASS_SWITCH.cost} coins, and you can switch once every ${CLASS_SWITCH.everyDays} days.`
        : `Your first pick is free. After that, a switch costs ${CLASS_SWITCH.cost} coins, once every ${CLASS_SWITCH.everyDays} days.`,
      confirmLabel: switching ? `Pay ${CLASS_SWITCH.cost}` : "Choose",
    });
    if (!ok) return;
    const res = await run("Couldn't change class", () =>
      switching ? switchClass(id) : pickClass(id),
    );
    if (res) setSheet(null);
  }

  return (
    <RpgScreen>
      <TabHeader
        kicker={
          view ? (
            `${view.className ?? "No class yet"} · Energy ${view.energy} / ${view.energyMax}${view.power != null ? ` · Power ${view.power}` : ""}`
          ) : (
            <Skeleton className="h-3 w-40" />
          )
        }
        title="Battle"
      />

      {status === "unavailable" ? (
        <p className="px-5 py-8 text-sm text-rpg-text-2">
          Can&apos;t load your battles right now. They&apos;ll show here once
          you&apos;re back online.
        </p>
      ) : !view ? (
        <div className="flex flex-col gap-4 px-5 py-5" aria-label="Loading">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !view.classId ? (
        <section
          className="flex flex-col gap-3 px-5 py-5"
          aria-label="Pick your class"
        >
          <h2 className={HEADING}>Pick your class</h2>
          <p className="text-xs leading-relaxed text-rpg-text-2">
            Your class decides how your power becomes health, attack and
            defense, and gives you a skill and an ultimate. The first pick is
            free.
          </p>
          <ClassPicker
            classes={view.classes}
            current={null}
            disabled={busy || !online}
            onPick={(id) => void choose(id)}
          />
          {!online && (
            <p className="text-xs text-rpg-muted">You&apos;re offline.</p>
          )}
        </section>
      ) : (
        <>
          <section
            className="flex flex-col gap-2 border-b border-rpg-line px-5 py-4"
            aria-label="Energy and points"
          >
            <p className="text-xs leading-relaxed text-rpg-text-2">
              Each workout gives fight energy for the Campaign and the endless
              tower. The weekly boss and the Boss Tower don&apos;t use it.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setSheet("points")} className={SECONDARY}>
                Points
                {view.points.free > 0 ? ` · ${view.points.free} free` : ""}
              </button>
              <button onClick={() => setSheet("class")} className={SECONDARY}>
                Class · {view.className}
              </button>
              <button
                onClick={() => setSheet("history")}
                aria-haspopup="dialog"
                className={SECONDARY}
              >
                History
              </button>
            </div>
            {view.paused && (
              <p className="text-xs text-rpg-muted">
                You&apos;re paused. Your stats are frozen, and you can still
                fight.
              </p>
            )}
          </section>
          {view.cards.map((card) => (
            <FightCard
              key={card.mode}
              card={card}
              busy={busy}
              online={online}
              onFight={(opts) => void go(card.mode, opts)}
            />
          ))}
          {raid && (
            <RaidCard
              view={raid}
              busy={busy}
              online={online}
              onOpenParty={() => setSheet("raid")}
              onJoin={(id) => raidDo("Couldn't join", () => joinRaid(id))}
              onDecline={(id) => raidDo("Couldn't decline", () => leaveRaid(id))}
              onOpenResult={(id) => {
                const outcome = raids.data.find((r) => r.id === id)?.outcome;
                if (outcome) setRaidResult(outcome);
              }}
            />
          )}
        </>
      )}

      {sheet === "class" && view?.classId && (
        <Sheet title="Class" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-3 px-5 py-4">
            <p className="text-xs text-rpg-text-2">
              A switch costs {view.classSwitch.cost} coins and can happen once
              every {CLASS_SWITCH.everyDays} days.
              {view.classSwitch.reason ? ` ${view.classSwitch.reason}.` : ""}
            </p>
            <ClassPicker
              classes={view.classes}
              current={view.classId}
              disabled={busy || !online || !view.classSwitch.enabled}
              onPick={(id) => void choose(id)}
            />
          </div>
        </Sheet>
      )}
      {sheet === "points" && view && (
        <PointsSheet
          points={view.points}
          coins={state.data?.coins ?? 0}
          busy={busy}
          online={online}
          onClose={() => setSheet(null)}
          onApply={async (add) =>
            (await run("Couldn't spend points", () =>
              assignStatPoints(add, view.points.spent),
            )) !== undefined
          }
          onRespec={async () => {
            const ok = await confirmRpgDialog({
              title: "Reset all stat points?",
              message: `It costs ${view.points.respecCost} coins and gives every point back to spend again.`,
              confirmLabel: `Pay ${view.points.respecCost}`,
            });
            if (ok)
              await run("Couldn't reset points", () =>
                respecStatPoints(view.points.spent),
              );
          }}
        />
      )}
      {sheet === "raid" && raid && (
        <RaidPartySheet
          view={raid}
          friends={friends}
          busy={busy}
          online={online}
          onClose={() => setSheet(null)}
          onCreate={(tier) =>
            raidDo("Couldn't make the party", () => createRaid(tier))
          }
          onInvite={(uid) =>
            raid.lobby &&
            raidDo("Couldn't invite", () => inviteToRaid(raid.lobby!.id, uid))
          }
          onKick={(uid) =>
            raid.lobby &&
            raidDo("Couldn't remove", () => kickFromRaid(raid.lobby!.id, uid))
          }
          onTier={(tier) =>
            raid.lobby &&
            tier !== raid.lobby.tier &&
            raidDo("Couldn't change the tier", () =>
              setRaidTier(raid.lobby!.id, tier),
            )
          }
          onStart={() => void beginRaid()}
          onCancel={() => void endRaid("cancel")}
          onLeave={() => void endRaid("leave")}
        />
      )}
      {raidResult && (
        <RaidResultScreen
          view={raidResultView(raidResult, profile.uid)}
          onDone={() => {
            setRaidResult(null);
            if (raidFromHistory) setSheet("history");
            setRaidFromHistory(false);
          }}
        />
      )}
      {sheet === "history" && view && (
        <FightHistorySheet
          uid={profile.uid}
          now={now}
          timeZone={timeZone}
          raids={raids.data}
          onOpenRaid={(id) => {
            const outcome = raids.data.find((r) => r.id === id)?.outcome;
            if (!outcome) return;
            // The sheet is in the top layer, above the result screen, so it steps aside first.
            setSheet(null);
            setRaidFromHistory(true);
            setRaidResult(outcome);
          }}
          onClose={() => setSheet(null)}
          onOpen={(fight) => {
            // The sheet is in the top layer, above the result screen, so it steps aside first.
            setSheet(null);
            setFromHistory(true);
            setReplaying(false);
            setResult(resultView(fight));
          }}
        />
      )}
      {result && replaying && result.replay && (
        <FightReplay
          rounds={result.replay}
          onDone={() => setReplaying(false)}
        />
      )}
      {result && !replaying && (
        <FightResultScreen
          view={result}
          onDone={() => {
            setResult(null);
            if (fromHistory) setSheet("history");
            setFromHistory(false);
          }}
          onReplay={() => setReplaying(true)}
        />
      )}
    </RpgScreen>
  );
}
