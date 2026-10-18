"use client";

import { useMemo, useState } from "react";
import { useProfile } from "@/components/AuthProvider";
import { BreaksPanel } from "@/components/rpg/BreaksPanel";
import { Disclosure, OfflineNote } from "@/components/rpg/Disclosure";
import { RpgScreen, Skeleton } from "@/components/rpg/RpgScreen";
import { ScheduleEditor } from "@/components/rpg/ScheduleEditor";
import { TabHeader } from "@/components/rpg/TabHeader";
import { useCustomExercises } from "@/lib/customExercises";
import { confirmDialog, errorDialog } from "@/lib/dialog";
import { activeInjuries, activePause } from "@/lib/game/breaks";
import { questCards, rerollInfo, type QuestCard } from "@/lib/game/questsView";
import { buildExerciseLookup } from "@/lib/game/sets";
import { dayId, weekId as weekIdOf } from "@/lib/game/time";
import { claimQuest, rerollQuest } from "@/lib/gameApi";
import { useRoutines } from "@/lib/routines";
import { useGameState, useQuests, useSchedule } from "@/lib/useGame";
import { useOnline } from "@/lib/useOnline";
import { useWorkouts } from "@/lib/useWorkouts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Weekly quests, the workout schedule, and pause and injury controls. */
export default function QuestsPage() {
  const profile = useProfile();
  const online = useOnline();
  const gameState = useGameState(profile.uid);
  const schedule = useSchedule(profile.uid);
  const routines = useRoutines(profile.uid);
  const custom = useCustomExercises();
  const lookup = useMemo(() => buildExerciseLookup(custom), [custom]);
  const [now] = useState(() => Date.now());

  // This screen sends the browser's time zone with every request, so it counts weeks the same way.
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const quests = useQuests(profile.uid, timeZone);
  // The week's start, minus a day of slack for the time zone: questProgress filters to the week itself.
  const [since] = useState(() => Date.parse(`${weekIdOf(Date.now(), timeZone)}T00:00:00Z`) - DAY_MS);
  const workouts = useWorkouts(profile.uid, { since }).workouts;

  const cards = useMemo(
    () =>
      quests.data && workouts
        ? questCards(
            quests.data,
            { weekId: quests.data.weekId, timeZone: quests.data.timeZone, workouts, lookup, matched: schedule.data?.matched ?? {} },
            now,
          )
        : null,
    [quests.data, workouts, lookup, schedule.data, now],
  );

  const state = gameState.data;
  const coins = state?.coins ?? 0;
  const today = dayId(now, timeZone);
  const reroll = quests.data ? rerollInfo(quests.data) : null;
  const [busy, setBusy] = useState<string | null>(null);

  async function claim(card: QuestCard) {
    if (!quests.data) return;
    setBusy(card.id);
    try {
      await claimQuest(quests.data.weekId, card.id);
    } catch (err) {
      void errorDialog("Couldn't claim the quest", err);
    } finally {
      setBusy(null);
    }
  }

  async function swap(card: QuestCard) {
    if (!quests.data || !reroll || reroll.cost == null) return;
    const ok = await confirmDialog({
      title: "Reroll this quest?",
      message: `You get a different quest in its place for ${reroll.cost} coins. ${reroll.left - 1} reroll${reroll.left === 2 ? "" : "s"} left after this one.`,
      confirmLabel: `Reroll for ${reroll.cost}`,
    });
    if (!ok) return;
    setBusy(card.id);
    try {
      await rerollQuest(quests.data.weekId, card.id, quests.data.rerollsUsed);
    } catch (err) {
      void errorDialog("Couldn't reroll the quest", err);
    } finally {
      setBusy(null);
    }
  }

  const paused = state ? activePause(state, now) : null;
  const injured = state ? activeInjuries(state, now).length : 0;
  const breaksSummary = paused ? "Paused" : injured > 0 ? `${injured} injured` : "";
  const scheduleDays = schedule.data?.versions.at(-1)?.days ?? {};
  const scheduledDays = Object.keys(scheduleDays).length;

  return (
    <RpgScreen>
      <TabHeader
        kicker={state ? `${state.coins.toLocaleString("en-US")} coins` : <Skeleton className="h-3 w-24" />}
        title="Quests"
      />

      <section className="flex flex-col gap-4 border-b border-rpg-line px-5 py-4" aria-label="This week's quests">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-rpg-head text-xl font-semibold uppercase">This week</h2>
          <span className="text-[11px] text-rpg-muted">Resets Sunday</span>
        </div>

        {cards ? (
          cards.map((card) => (
            <QuestRow
              key={card.id}
              card={card}
              busy={busy === card.id}
              locked={busy != null || !online}
              canReroll={reroll?.cost != null && coins >= reroll.cost}
              rerollCost={reroll?.cost ?? null}
              onClaim={() => void claim(card)}
              onReroll={() => void swap(card)}
            />
          ))
        ) : quests.error ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-rpg-text-2">Couldn&apos;t load this week&apos;s quests. {quests.error}</p>
            <button onClick={quests.retry} className="min-h-11 border border-rpg-line-strong px-3 text-xs">
              Try again
            </button>
          </div>
        ) : !online && !quests.data ? (
          <p className="text-xs leading-relaxed text-rpg-text-2">
            Quests load when you&apos;re back online. Your workouts still count toward them.
          </p>
        ) : (
          <div aria-busy="true" aria-label="Loading quests" className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-1 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!online && cards && <OfflineNote what="Claiming and rerolling" />}
        {reroll && cards && <p className="text-[11px] leading-relaxed text-rpg-muted">{reroll.label}</p>}
        {reroll?.cost != null && cards && coins < reroll.cost && (
          <p className="text-[11px] text-rpg-muted">You need {reroll.cost} coins to reroll.</p>
        )}
      </section>

      <Disclosure
        title="Schedule"
        summary={schedule.data ? `${scheduledDays} ${scheduledDays === 1 ? "day" : "days"} a week` : undefined}
      >
        <ScheduleEditor routines={routines} schedule={schedule.data} today={today} online={online} />
      </Disclosure>

      <Disclosure title="Breaks" summary={breaksSummary}>
        <BreaksPanel state={state} now={now} timeZone={timeZone} online={online} />
      </Disclosure>
    </RpgScreen>
  );
}

function QuestRow({
  card,
  busy,
  locked,
  canReroll,
  rerollCost,
  onClaim,
  onReroll,
}: {
  card: QuestCard;
  busy: boolean;
  locked: boolean;
  canReroll: boolean;
  rerollCost: number | null;
  onClaim: () => void;
  onReroll: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 break-words">{card.title}</span>
        <span className="shrink-0 text-rpg-muted">
          {card.progress} / {card.target}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={card.title}
        aria-valuemin={0}
        aria-valuemax={card.target}
        aria-valuenow={card.progress}
        className="h-1 bg-rpg-line"
      >
        <div className={`h-full ${card.state === "claimed" ? "bg-rpg-good" : "bg-rpg-accent"}`} style={{ width: `${card.pct}%` }} />
      </div>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-[11px] text-rpg-muted">{card.reward}</span>
        {card.state === "complete" && (
          <button
            onClick={onClaim}
            disabled={locked}
            className="min-h-11 min-w-[88px] bg-rpg-text px-4 text-xs font-semibold text-rpg-bg disabled:opacity-40"
          >
            {busy ? "Claiming…" : "Claim"}
          </button>
        )}
        {card.state === "claimed" && <span className="text-xs text-rpg-good">Claimed</span>}
        {card.state === "expired" && <span className="text-xs text-rpg-muted">Expired</span>}
        {card.state === "active" && rerollCost != null && (
          <button
            onClick={onReroll}
            disabled={locked || !canReroll}
            className="min-h-11 border border-rpg-line-strong px-3 text-xs disabled:opacity-40"
          >
            {busy ? "Rerolling…" : `Reroll · ${rerollCost} coins`}
          </button>
        )}
      </div>
    </div>
  );
}
