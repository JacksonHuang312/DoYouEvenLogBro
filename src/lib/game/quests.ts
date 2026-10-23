import type { Workout } from "../types";
import { freezeFor, injuredStats, type Result } from "./breaks";
import { profileOf, type GameState } from "./claim";
import { QUESTS, STAT_MUSCLES, STATS, SUB_MUSCLES, type Stat, type SubMuscle } from "./config";
import { levelForXp } from "./economy";
import type { MusclesFacts } from "./facts";
import { statOf } from "./muscles";
import { seeded } from "./random";
import { statScore, subMuscleScores, type SubMuscleScores } from "./score";
import { slotsBetween, type MatchedSlot, type ScheduleDoc } from "./schedule";
import { countsAsWorkout, workingSets, type ExerciseLookup } from "./sets";
import { addDays, dayId, dayStartMs, weekId as weekIdOf } from "./time";

/*
 * Weekly quests (GAME_DESIGN.md 3.4). Three a week, made the first time the week is opened and
 * stored in quests/{weekId}: the weakest stat, the weakest sub-muscle of another stat, and a
 * consistency quest. Which ones is a pure function of the scores and a seed, so the same inputs
 * always give the same quests. Progress is never stored: it is counted from the week's workouts.
 */

export type QuestKind = "stat-sets" | "muscle-sets" | "scheduled" | "days" | "workouts";

export interface Quest {
  /** Changes when the quest is rerolled, so a stale claim can't hit the replacement. */
  id: string;
  slot: 0 | 1 | 2;
  kind: QuestKind;
  stat?: Stat;
  muscle?: SubMuscle;
  target: number;
  title: string;
  reward: { coins: number; xp: number };
  /** How many times this slot has been rerolled (also seeds the next pick). */
  rerolls: number;
  claimedAt: number | null;
}

/** users/{uid}/quests/{weekId} */
export interface QuestsDoc {
  weekId: string;
  timeZone: string;
  generatedAt: number;
  /** Paid rerolls used this week (injury swaps are free and not counted). */
  rerollsUsed: number;
  quests: Quest[];
  updatedAt: number;
}

/** What a claim changed in a quest, for the Rewards screen. */
export interface QuestUpdate {
  id: string;
  title: string;
  before: number;
  after: number;
  target: number;
  /** Set when this claim completed the quest and paid it. */
  paid: { coins: number; xp: number } | null;
}

/** What quest picking depends on, so it stays deterministic. */
export interface QuestContext {
  uid: string;
  weekId: string;
  scores: SubMuscleScores;
  /** Stats with an active injury flag: never targeted. */
  injured: Stat[];
  /** Scheduled days from today to the end of the week. */
  scheduledLeft: number;
}

/**
 * What picking depends on at `now`: the real sub-muscle scores (decay and freezes applied), the
 * injured stats, and the scheduled days still open from today to the end of the week.
 */
export function questContext({
  uid,
  weekId,
  state,
  muscles,
  schedule,
  now,
  timeZone,
}: {
  uid: string;
  weekId: string;
  state: GameState;
  muscles: MusclesFacts;
  schedule: ScheduleDoc;
  now: number;
  timeZone: string;
}): QuestContext {
  const today = dayId(now, timeZone);
  const weekEnd = addDays(weekId, 6);
  return {
    uid,
    weekId,
    scores: subMuscleScores(muscles, profileOf(state), now, timeZone, freezeFor(state)),
    injured: injuredStats(state, now),
    scheduledLeft: slotsBetween(schedule, state, today, weekEnd).filter((s) => !schedule.matched[s.day]).length,
  };
}

// ---- Picking ----

const label = (stat: Stat) => stat[0].toUpperCase() + stat.slice(1);

/** Core is ranked as if it scored higher, so it is the weakest pick less often. */
const rankKey = (stat: Stat, score: number) => (stat === "core" ? score / QUESTS.coreWeight : score);

/** Things a new pick must not repeat: the other slots' targets and this slot's current one. */
interface Avoid {
  stats: Stat[];
  muscles: SubMuscle[];
  kinds: QuestKind[];
}

function rankedStats(ctx: QuestContext, avoid: Avoid): Stat[] {
  return STATS.filter((s) => !ctx.injured.includes(s) && !avoid.stats.includes(s)).sort(
    (a, b) => rankKey(a, statScore(a, ctx.scores)) - rankKey(b, statScore(b, ctx.scores)),
  );
}

function rankedMuscles(ctx: QuestContext, avoid: Avoid): SubMuscle[] {
  return SUB_MUSCLES.filter((m) => {
    const stat = statOf(m);
    const weight = (STAT_MUSCLES[stat] as Record<string, number>)[m];
    return weight >= QUESTS.minMuscleWeight && !ctx.injured.includes(stat) && !avoid.stats.includes(stat) && !avoid.muscles.includes(m);
  }).sort((a, b) => rankKey(statOf(a), ctx.scores[a]) - rankKey(statOf(b), ctx.scores[b]));
}

/** The weakest on the first pick, a random one of the weakest few on a reroll (which is then not "the weakest"). */
function pick<T>(ranked: T[], rerolls: number, rand: () => number): { item: T; weakest: boolean } | null {
  if (ranked.length === 0) return null;
  const index = rerolls === 0 ? 0 : Math.floor(rand() * Math.min(QUESTS.rerollPool, ranked.length));
  return { item: ranked[index], weakest: rerolls === 0 };
}

/** The stat a quest trains, if it trains one. */
export const questStat = (q: Pick<Quest, "stat" | "muscle">): Stat | null => q.stat ?? (q.muscle ? statOf(q.muscle) : null);

function build(slot: 0 | 1 | 2, rerolls: number, ctx: QuestContext, avoid: Avoid): Quest | null {
  const rand = seeded(`${ctx.uid}:${ctx.weekId}:${slot}:${rerolls}`);
  const base = { id: `s${slot}r${rerolls}`, slot, rerolls, reward: QUESTS.rewards[slot], claimedAt: null };

  if (slot === 0) {
    const chosen = pick(rankedStats(ctx, avoid), rerolls, rand);
    if (!chosen) return null;
    const stat = chosen.item;
    const sets = QUESTS.statSets;
    const title = chosen.weakest
      ? `${label(stat)} is your lowest stat: log ${sets} working sets of ${stat}`
      : `Log ${sets} working sets of ${stat}`;
    return { ...base, slot, kind: "stat-sets", stat, target: sets, title };
  }

  if (slot === 1) {
    const chosen = pick(rankedMuscles(ctx, avoid), rerolls, rand);
    if (!chosen) return null;
    const muscle = chosen.item;
    const sets = QUESTS.muscleSets;
    const title = chosen.weakest
      ? `Lagging muscle: log ${sets} working sets of ${muscle}`
      : `Log ${sets} working sets of ${muscle}`;
    return { ...base, slot, kind: "muscle-sets", muscle, target: sets, title };
  }

  const kinds: QuestKind[] = [
    ...(ctx.scheduledLeft >= QUESTS.scheduledMin ? (["scheduled"] as const) : []),
    "days",
    "workouts",
  ].filter((k) => !avoid.kinds.includes(k as QuestKind)) as QuestKind[];
  const chosen = pick(kinds, rerolls, rand);
  if (!chosen) return null;
  const kind = chosen.item;
  const target =
    kind === "scheduled"
      ? Math.min(ctx.scheduledLeft, QUESTS.scheduledMax)
      : kind === "days"
        ? QUESTS.daysTarget
        : QUESTS.workoutsTarget;
  const title =
    kind === "scheduled"
      ? `Do ${target} scheduled workouts on their day`
      : kind === "days"
        ? `Train on ${target} different days`
        : `Finish ${target} workouts`;
  return { ...base, slot, kind, target, title };
}

/** What a quest in another slot (or this one's current pick) rules out for a new pick. */
function avoidFor(quests: Quest[], slot: number): Avoid {
  const stats: Stat[] = [];
  const muscles: SubMuscle[] = [];
  const kinds: QuestKind[] = [];
  for (const q of quests) {
    const stat = questStat(q);
    if (stat) stats.push(stat);
    if (q.muscle) muscles.push(q.muscle);
    // Slot 2 only avoids its own current kind; the other slots never share a kind with it.
    if (q.slot === slot && q.slot === 2) kinds.push(q.kind);
  }
  return { stats, muscles, kinds };
}

/** This week's quests, in slot order. The weakest stat first, then the weakest muscle of another stat. */
export function generateQuests(ctx: QuestContext, timeZone: string, now: number): QuestsDoc {
  const quests: Quest[] = [];
  for (const slot of [0, 1, 2] as const) {
    const quest = build(slot, 0, ctx, avoidFor(quests, -1));
    if (quest) quests.push(quest);
  }
  return { weekId: ctx.weekId, timeZone, generatedAt: now, rerollsUsed: 0, quests, updatedAt: now };
}

// ---- Progress ----

/** The week's workouts and the facts progress is counted from. */
export interface QuestWeek {
  weekId: string;
  timeZone: string;
  workouts: Pick<Workout, "startedAt" | "exercises">[];
  lookup: ExerciseLookup;
  /** game/schedule.matched: scheduled days that were filled. */
  matched: Record<string, Pick<MatchedSlot, "daysOff">>;
}

/** How far along a quest is, counted from the week's workouts (not capped at the target). */
export function questProgress(quest: Quest, week: QuestWeek): number {
  const counted = week.workouts.filter(
    (w) => weekIdOf(w.startedAt, week.timeZone) === week.weekId && countsAsWorkout(w, week.lookup),
  );
  switch (quest.kind) {
    case "workouts":
      return counted.length;
    case "days":
      return new Set(counted.map((w) => dayId(w.startedAt, week.timeZone))).size;
    case "scheduled": {
      const end = addDays(week.weekId, 7);
      return Object.entries(week.matched).filter(([day, m]) => day >= week.weekId && day < end && m.daysOff === 0).length;
    }
    case "stat-sets":
      return counted.reduce(
        (n, w) => n + workingSets(w, week.lookup).filter((s) => statOf(s.info.muscle) === quest.stat).length,
        0,
      );
    case "muscle-sets":
      return counted.reduce(
        (n, w) => n + workingSets(w, week.lookup).filter((s) => s.info.muscle === quest.muscle).length,
        0,
      );
  }
}

export const isComplete = (quest: Quest, progress: number) => progress >= quest.target;

/** The first moment a week's quests can no longer be claimed. */
export const claimDeadline = (weekId: string, timeZone: string) =>
  dayStartMs(addDays(weekId, 7 + QUESTS.claimGraceDays), timeZone);

// ---- Rerolls and swaps ----

type ProgressOf = (quest: Quest) => number;

/** Replaces one slot's quest with the next pick, skipping any that are already finished. */
function replacement(doc: QuestsDoc, old: Quest, ctx: QuestContext, progressOf: ProgressOf): Quest | null {
  const others = doc.quests.filter((q) => q.slot !== old.slot);
  const avoid = avoidFor([...others, old], old.slot);
  for (let rerolls = old.rerolls + 1; rerolls <= old.rerolls + 6; rerolls++) {
    const next = build(old.slot, rerolls, ctx, avoid);
    if (next && !isComplete(next, progressOf(next))) return next;
  }
  return null;
}

const swap = (doc: QuestsDoc, old: Quest, next: Quest): Quest[] => doc.quests.map((q) => (q === old ? next : q));

/**
 * Rerolls a quest for coins: QUESTS.rerollCosts[n] for the (n+1)th reroll of the week, at most
 * QUESTS.rerollCosts.length. `expectedRerolls` is how many the caller saw, so a retried request
 * can't be charged twice. A claimed or finished quest can't be rerolled.
 */
export function rerollQuest(
  doc: QuestsDoc,
  questId: string,
  expectedRerolls: number,
  ctx: QuestContext,
  progressOf: ProgressOf,
  now: number,
): Result<{ doc: QuestsDoc; cost: number }> {
  if (doc.rerollsUsed !== expectedRerolls) return { ok: false, error: "Those quests changed. Reload and try again" };
  const cost = QUESTS.rerollCosts[doc.rerollsUsed];
  if (cost === undefined) return { ok: false, error: "No rerolls left this week" };
  const old = doc.quests.find((q) => q.id === questId);
  if (!old) return { ok: false, error: "That quest was already replaced" };
  if (old.claimedAt != null || isComplete(old, progressOf(old))) return { ok: false, error: "That quest is already finished" };
  const next = replacement(doc, old, ctx, progressOf);
  if (!next) return { ok: false, error: "No other quest is available" };
  return { ok: true, value: { doc: { ...doc, quests: swap(doc, old, next), rerollsUsed: doc.rerollsUsed + 1, updatedAt: now }, cost } };
}

/**
 * Replaces unclaimed quests that train a newly injured stat, free of charge. `ctx.injured` must
 * already include the new flag. A quest with no replacement is left as is.
 */
export function swapInjuredQuests(doc: QuestsDoc, ctx: QuestContext, progressOf: ProgressOf, now: number): QuestsDoc {
  let quests = doc.quests;
  for (const old of doc.quests) {
    const stat = questStat(old);
    if (old.claimedAt != null || !stat || !ctx.injured.includes(stat)) continue;
    const next = replacement({ ...doc, quests }, old, ctx, progressOf);
    if (next) quests = quests.map((q) => (q === old ? next : q));
  }
  return quests === doc.quests ? doc : { ...doc, quests, updatedAt: now };
}

// ---- Rewards ----

/** Whether a quest can be paid now: finished, unclaimed and not past its grace period. */
export function claimable(doc: QuestsDoc, quest: Quest, progress: number, now: number): boolean {
  return quest.claimedAt == null && isComplete(quest, progress) && now < claimDeadline(doc.weekId, doc.timeZone);
}

/** Marks every claimable quest as paid at `now`. Idempotent: a paid quest is never in `paid` again. */
export function payQuests(doc: QuestsDoc, progressOf: ProgressOf, now: number): { doc: QuestsDoc; paid: Quest[] } {
  const paid = doc.quests.filter((q) => claimable(doc, q, progressOf(q), now));
  if (paid.length === 0) return { doc, paid };
  const quests = doc.quests.map((q) => (paid.includes(q) ? { ...q, claimedAt: now } : q));
  return { doc: { ...doc, quests, updatedAt: now }, paid };
}

/** Pays one quest by id (the Claim button, for quests finished by an edit). */
export function payQuest(doc: QuestsDoc, questId: string, progressOf: ProgressOf, now: number): Result<{ doc: QuestsDoc; quest: Quest }> {
  const quest = doc.quests.find((q) => q.id === questId);
  if (!quest) return { ok: false, error: "That quest was replaced" };
  if (quest.claimedAt != null) return { ok: false, error: "Already claimed" };
  if (now >= claimDeadline(doc.weekId, doc.timeZone)) return { ok: false, error: "This week's quests have expired" };
  if (!isComplete(quest, progressOf(quest))) return { ok: false, error: "Not finished yet" };
  const paid = { ...quest, claimedAt: now };
  return { ok: true, value: { doc: { ...doc, quests: doc.quests.map((q) => (q === quest ? paid : q)), updatedAt: now }, quest: paid } };
}

/**
 * What one claimed workout does to the week's quests: progress with and without it, and every
 * quest it finished (or that was already finished) paid. `updates` lists the quests that moved
 * or paid, for the Rewards screen.
 */
export function questsAfterWorkout(
  doc: QuestsDoc,
  before: QuestWeek,
  after: QuestWeek,
  now: number,
): { doc: QuestsDoc; paid: Quest[]; updates: QuestUpdate[] } {
  const { doc: next, paid } = payQuests(doc, (q) => questProgress(q, after), now);
  const updates = doc.quests.flatMap((q): QuestUpdate[] => {
    const was = questProgress(q, before);
    const moved = questProgress(q, after);
    const reward = paid.find((p) => p.id === q.id)?.reward ?? null;
    return was !== moved || reward ? [{ id: q.id, title: q.title, before: was, after: moved, target: q.target, paid: reward }] : [];
  });
  return { doc: next, paid, updates };
}

/** Adds quest rewards to coins and XP. Not counted toward the daily coin cap. */
export function withQuestRewards(state: GameState, quests: Pick<Quest, "reward">[], now: number): GameState {
  const coins = quests.reduce((n, q) => n + q.reward.coins, 0);
  const xp = quests.reduce((n, q) => n + q.reward.xp, 0);
  return { ...state, coins: state.coins + coins, xp: state.xp + xp, level: levelForXp(state.xp + xp), updatedAt: now };
}
