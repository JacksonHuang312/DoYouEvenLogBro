import { randomUUID } from "node:crypto";
import { boardAfterFight, type BoardStats } from "../game/boards";
import { energyOf, type MusclesDoc } from "../game/claim";
import { DEFAULT_TIME_ZONE, type ClassId, type Rarity } from "../game/config";
import { gearEffects } from "../game/effects";
import { applyFightRewards, fightHero, fightWeek, newBattleDoc, runFight, type BattleDoc, type FightMode, type FightRound } from "../game/fights";
import { pickClass, switchClass } from "../game/heroClass";
import { materialsOf, type Item, type Materials } from "../game/items";
import { adminDb } from "./admin";
import { stateOf, unwrap, wornItems } from "./items";
import { gameRefs } from "./refs";

// ---- Fights ----

export interface FightRequest {
  mode: FightMode;
  /** Made by the client per tap; a retry with the same id returns the stored fight instead of fighting again. */
  requestId: string;
  floor?: number;
  climb?: boolean;
}

/** users/{uid}/fights/{requestId}: what a fight request did, for the result screen and its log. */
export interface FightRecord {
  mode: FightMode;
  at: number;
  /** The server's seed: the same hero and enemy replay the same way from it. */
  seed: string;
  classId: ClassId;
  heroPower: number;
  rounds: FightRound[];
  won: boolean;
  coins: number;
  scrap: number;
  mythicCores: number;
  items: { id: string; baseId: string; rarity: Rarity; itemLevel?: number }[];
  /**
   * Drops that became scrap and not an item. With an item level: auto-salvage (13.9), paid on top of
   * `scrap`. Without one: a fight from before the item rework, which turned duplicates into scrap.
   */
  salvaged?: { baseId: string; rarity: Rarity; scrap: number; itemLevel?: number }[];
  /** Boss Tower wins: whether it was the floor's first clear. */
  firstClear?: boolean;
  /** Whether a guarantee forced a drop. */
  guaranteed: boolean;
}

export interface FightResponse {
  status: "fought" | "already-fought";
  fight: FightRecord;
  battle: BattleDoc;
  coins: number;
  materials: Materials;
  /** Fight energy left (Campaign and endless tower). */
  energy: number;
}

/**
 * Runs one fight request in one transaction (GAME_DESIGN.md 10, Phase 5): checks the mode's rules
 * (daily limit, cooldowns, level gates, the next floor or stage, boss minimums), fights with the
 * player's rusted stats and worn gear, and pays coins, scrap, Mythic Cores and drops. The seed is
 * made here, never by the client. The weekly reset uses the saved time zone, so changing the
 * device's zone can't buy an extra fight.
 */
export async function fightAction(uid: string, input: FightRequest): Promise<FightResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);
  const fightRef = r.fights.doc(input.requestId);

  return db.runTransaction(async (tx) => {
    const [fightSnap, stateSnap, musclesSnap, battleSnap, publicSnap] = await tx.getAll(fightRef, r.state, r.muscles, r.battle, r.publicStats);
    const now = Date.now();
    const state = stateOf(stateSnap, now, DEFAULT_TIME_ZONE);
    const doc = battleSnap.exists ? (battleSnap.data() as BattleDoc) : newBattleDoc(now);
    if (fightSnap.exists) {
      return { status: "already-fought", fight: fightSnap.data() as FightRecord, battle: doc, coins: state.coins, materials: materialsOf(state), energy: energyOf(state) };
    }

    const muscles = musclesSnap.exists ? (musclesSnap.data() as MusclesDoc).muscles : {};
    const worn = await wornItems(tx, r, state);
    const fighter = unwrap(fightHero({ state, muscles, worn, now }));
    const seed = randomUUID();
    const outcome = unwrap(
      runFight({ mode: input.mode, doc, state, fighter, now, timeZone: state.timeZone, seed, floor: input.floor, climb: input.climb }),
    );

    // Auto-salvaged drops pay what a salvage by hand would, a worn salvage charm included.
    const salvageBonus = worn.length ? gearEffects(worn, state.level).salvageYield : 0;
    const rewards = applyFightRewards({ state, outcome, fightId: input.requestId, now, salvageBonus });

    const fight: FightRecord = {
      mode: input.mode,
      at: now,
      seed,
      classId: state.classId!,
      heroPower: Math.round(fighter.battle.total * 10) / 10,
      rounds: outcome.rounds,
      won: outcome.rounds.some((x) => x.result.won),
      coins: outcome.coins,
      scrap: outcome.scrap,
      mythicCores: outcome.mythicCores,
      items: rewards.items.map(({ id, item }) => ({ id, baseId: item.baseId, rarity: item.rarity, itemLevel: item.itemLevel })),
      ...(rewards.salvaged.length ? { salvaged: rewards.salvaged } : {}),
      ...(outcome.firstClear != null ? { firstClear: outcome.firstClear } : {}),
      guaranteed: outcome.drops.some((d) => d.guaranteed),
    };
    for (const { id, item } of rewards.items) tx.create(r.inventory.doc(id), item satisfies Item);
    tx.set(fightRef, fight);
    tx.set(r.battle, outcome.doc);
    tx.set(r.state, rewards.state);
    // Friend leaderboards (13.27): this fight's rounds added to the fight week's totals.
    const board = boardAfterFight(
      (publicSnap.data() as { board?: BoardStats } | undefined)?.board,
      { week: fightWeek(now, state.timeZone), level: state.level, classId: state.classId!, rounds: outcome.rounds.map((x) => x.result.stats) },
      now,
    );
    tx.set(r.publicStats, { board }, { merge: true });
    return { status: "fought", fight, battle: outcome.doc, coins: rewards.state.coins, materials: materialsOf(rewards.state), energy: energyOf(rewards.state) };
  });
}

// ---- Class ----

export type ClassAction = { action: "pick" | "switch"; classId: ClassId };

export interface ClassResponse {
  /** "already-done": a retry (or a request for the class you already have); nothing changed. */
  status: "done" | "already-done";
  classId: ClassId;
  coins: number;
  classSwitchedAt: number | null;
  cost: number;
}

/** Picks the free first class, or switches class for coins (once per 7 days). Safe to retry. */
export async function classAction(uid: string, input: ClassAction, timeZone?: string): Promise<ClassResponse> {
  const db = adminDb();
  const r = gameRefs(db, uid);

  return db.runTransaction(async (tx) => {
    const now = Date.now();
    const state = stateOf(await tx.get(r.state), now, timeZone ?? DEFAULT_TIME_ZONE);
    const answer = (status: ClassResponse["status"], s: typeof state, cost = 0): ClassResponse => ({
      status,
      classId: s.classId!,
      coins: s.coins,
      classSwitchedAt: s.classSwitchedAt ?? null,
      cost,
    });
    // A retried pick or switch finds the class already set.
    if (state.classId === input.classId) return answer("already-done", state);
    if (input.action === "pick") {
      const next = unwrap(pickClass(state, input.classId, now));
      tx.set(r.state, next);
      return answer("done", next);
    }
    const next = unwrap(switchClass(state, input.classId, now));
    tx.set(r.state, next.state);
    return answer("done", next.state, next.cost);
  });
}
