import type { Transaction } from "firebase-admin/firestore";
import { freezeFor } from "../game/breaks";
import { profileOf, type GameState, type MusclesDoc } from "../game/claim";
import { DEFAULT_TIME_ZONE } from "../game/config";
import type { MusclesFacts } from "../game/facts";
import type { QuestsDoc } from "../game/quests";
import { emptySchedule, type ScheduleDoc } from "../game/schedule";
import { computeStats } from "../game/score";
import {
  achievementProgress,
  buyTitleSlot,
  equipTitles,
  regularWindowStart,
  titlesOf,
  withEarnedTitles,
  type AchievementProgress,
  type TitleFacts,
  type TitleId,
  type TitlesState,
} from "../game/titles";
import { adminDb } from "./admin";
import { stateOf, unwrap } from "./items";
import { gameRefs, type GameRefs } from "./refs";

/**
 * Reads what achievements are computed from: recent claim times, the claim count and every
 * week's quests. `pending` is a claim being written in the same transaction (not readable yet),
 * with that week's quests as they will be after it.
 */
export async function readTitleFacts(
  tx: Transaction,
  r: GameRefs,
  {
    state,
    muscles,
    schedule,
    now,
    timeZone,
  }: { state: GameState; muscles: MusclesFacts; schedule: ScheduleDoc; now: number; timeZone: string },
  pending?: { claimedAt: number; quests: QuestsDoc | null },
): Promise<TitleFacts> {
  const recent = await tx.get(r.claims.where("claimedAt", ">=", regularWindowStart(now, timeZone)).select("claimedAt"));
  const count = await tx.get(r.claims.count());
  const questDocs = await tx.get(r.quests.select("quests"));

  const quests = new Map(questDocs.docs.map((d) => [d.id, d.data() as Pick<QuestsDoc, "quests">]));
  if (pending?.quests) quests.set(pending.quests.weekId, pending.quests);
  return {
    now,
    timeZone,
    state,
    stats: computeStats(muscles, profileOf(state), now, timeZone, freezeFor(state)),
    muscles,
    schedule,
    claimTimes: [...recent.docs.map((d) => d.get("claimedAt") as number), ...(pending ? [pending.claimedAt] : [])],
    claimCount: count.data().count + (pending ? 1 : 0),
    quests: [...quests.values()],
  };
}

export type TitleAction = { action: "check" } | { action: "equip"; titles: TitleId[] } | { action: "buy-slot"; expectedSlots: number };

export interface TitlesResponse {
  titles: TitlesState;
  progress: Record<TitleId, AchievementProgress>;
  /** Titles this request found newly earned. */
  earned: TitleId[];
  coins: number;
  cost?: number;
}

/**
 * Checks the achievements (recording any newly earned title), then equips titles or buys a
 * title slot. "check" is what the Titles tab calls when it opens, for the progress it shows.
 */
export async function titleAction(uid: string, input: TitleAction, timeZone?: string): Promise<TitlesResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);

  return db.runTransaction(async (tx) => {
    const [stateSnap, musclesSnap, scheduleSnap] = await tx.getAll(r.state, r.muscles, r.schedule);
    const now = Date.now();
    const state = stateOf(stateSnap, now, timeZone ?? DEFAULT_TIME_ZONE);
    const zone = timeZone ?? state.timeZone;
    const muscles = musclesSnap.exists ? (musclesSnap.data() as MusclesDoc).muscles : {};
    const schedule = scheduleSnap.exists ? (scheduleSnap.data() as ScheduleDoc) : emptySchedule(now);

    const progress = achievementProgress(await readTitleFacts(tx, r, { state, muscles, schedule, now, timeZone: zone }));
    const checked = withEarnedTitles(state, progress, now);

    let next = checked.state;
    let cost: number | undefined;
    if (input.action === "equip") next = unwrap(equipTitles(next, input.titles, now));
    if (input.action === "buy-slot") ({ state: next, cost } = unwrap(buyTitleSlot(next, input.expectedSlots, now)));

    if (next !== state) tx.set(r.state, next);
    return { titles: titlesOf(next), progress, earned: checked.earned, coins: next.coins, ...(cost != null ? { cost } : {}) };
  });
}
