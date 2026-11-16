import { randomUUID } from "node:crypto";
import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { boardAfterFight, type BoardStats } from "../game/boards";
import type { MusclesDoc } from "../game/claim";
import { DEFAULT_TIME_ZONE } from "../game/config";
import { gearEffects } from "../game/effects";
import { applyFightRewards, fightHero, fightWeek, newBattleDoc, type BattleDoc, type FightHero } from "../game/fights";
import type { Item } from "../game/items";
import {
  cancelRaid,
  canStartRaid,
  finishRaid,
  inviteToRaid,
  joinRaid,
  leaveRaid,
  newRaid,
  raidId as raidIdOf,
  setRaidTier,
  type RaidDoc,
  type RaidMemberRecord,
  type RaidRecord,
} from "../game/raidLobby";
import { checkParty, raidedThisWeek, raidTierFor, runRaid } from "../game/raids";
import { RAID } from "../game/config";
import { adminDb } from "./admin";
import { HttpError } from "./api";
import { stateOf, unwrap, wornItems } from "./items";
import { gameRefs, type GameRefs } from "./refs";

/*
 * Raids on the server (GAME_DESIGN.md 13.31): the lobby actions and the one transaction that
 * fights a raid and pays everyone. raids/{id} is written only here.
 */

export type RaidAction =
  /** Makes this week's party (one per leader per week), optionally asking people straight away. */
  | { action: "create"; tier: number; invite?: string[] }
  | { action: "invite"; raidId: string; uid: string }
  | { action: "join"; raidId: string }
  /** Leave a party you joined, or decline an invitation. */
  | { action: "leave"; raidId: string }
  | { action: "kick"; raidId: string; uid: string }
  | { action: "tier"; raidId: string; tier: number }
  | { action: "cancel"; raidId: string }
  | { action: "start"; raidId: string };

export interface RaidResponse {
  raidId: string;
  raid: RaidDoc;
}

const raidRef = (id: string) => adminDb().collection("raids").doc(id);
const userRef = (uid: string) => adminDb().collection("users").doc(uid);

/** A player as they would fight now, with everything a raid reads and writes for them. */
interface Fighter {
  uid: string;
  r: GameRefs;
  state: ReturnType<typeof stateOf>;
  battle: BattleDoc;
  board: BoardStats | undefined;
  hero: FightHero | null;
  /** The worn salvageYield effect, for a drop their auto-salvage turns into scrap. */
  salvageBonus: number;
  now: number;
}

/** Reads the players in a transaction (every read before any write). A player with no class has no hero. */
async function loadFighters(tx: Transaction, uids: string[], now: number): Promise<Fighter[]> {
  const db = adminDb();
  const refs = uids.map((uid) => gameRefs(db, uid));
  const snaps = await tx.getAll(...refs.flatMap((r) => [r.state, r.muscles, r.battle, r.publicStats] as DocumentReference[]));
  const out: Fighter[] = [];
  for (const [i, uid] of uids.entries()) {
    const [stateSnap, musclesSnap, battleSnap, publicSnap] = snaps.slice(i * 4, i * 4 + 4);
    const state = stateOf(stateSnap, now, DEFAULT_TIME_ZONE);
    const muscles = musclesSnap.exists ? (musclesSnap.data() as MusclesDoc).muscles : {};
    const worn = await wornItems(tx, refs[i], state);
    const made = fightHero({ state, muscles, worn, now });
    out.push({
      uid,
      r: refs[i],
      state,
      battle: battleSnap.exists ? (battleSnap.data() as BattleDoc) : newBattleDoc(now),
      board: (publicSnap.data() as { board?: BoardStats } | undefined)?.board,
      hero: made.ok ? made.value : null,
      salvageBonus: worn.length ? gearEffects(worn, state.level).salvageYield : 0,
      now,
    });
  }
  return out;
}

/** Usernames for display, read in the transaction. Throws for an account that doesn't exist. */
async function usernames(tx: Transaction, uids: string[]): Promise<Record<string, string>> {
  if (!uids.length) return {};
  const snaps = await tx.getAll(...uids.map(userRef));
  return Object.fromEntries(
    snaps.map((s, i) => {
      if (!s.exists) throw new HttpError(404, "That player doesn't exist");
      return [uids[i], String((s.data() as { username?: string }).username ?? "player")];
    }),
  );
}

/** Whether `a` and `b` follow each other: raids are for mutual follows only. */
async function mutual(tx: Transaction, a: string, b: string): Promise<boolean> {
  const [following, follower] = await tx.getAll(userRef(a).collection("following").doc(b), userRef(a).collection("followers").doc(b));
  return following.exists && follower.exists;
}

async function requireMutual(tx: Transaction, leader: string, uids: string[], names: Record<string, string>) {
  for (const uid of uids) {
    if (!(await mutual(tx, leader, uid))) throw new HttpError(409, `You and @${names[uid]} have to follow each other to raid together`);
  }
}

/** Lobby actions and the start. Every action is safe to retry. */
export async function raidAction(uid: string, input: RaidAction): Promise<RaidResponse> {
  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const now = Date.now();

    if (input.action === "create") {
      const [leader] = await loadFighters(tx, [uid], now);
      if (!leader.hero) throw new HttpError(409, "Pick a class first");
      const week = fightWeek(now, leader.state.timeZone);
      const id = raidIdOf(uid, week);
      const ref = raidRef(id);
      const existing = await tx.get(ref);
      // One party per leader per week: a second tap finds the first.
      if (existing.exists && (existing.data() as RaidDoc).status === "open") return { raidId: id, raid: existing.data() as RaidDoc };
      if (existing.exists && (existing.data() as RaidDoc).status === "done") throw new HttpError(409, "You've already raided this week");
      if (raidedThisWeek(leader.battle.raid?.weekId, now, leader.state.timeZone)) throw new HttpError(409, "You've already raided this week");
      const top = raidTierFor(leader.state.level, leader.hero.battle.total);
      if (top < 1) throw new HttpError(409, `Raids open at level ${RAID.tierLevels[0]} with ${Math.ceil(RAID.tierPower[0] * RAID.tierPowerShare)} battle power`);
      if (input.tier > top) throw new HttpError(409, `Tier ${input.tier} needs level ${RAID.tierLevels[input.tier - 1]} and ${Math.ceil(RAID.tierPower[input.tier - 1] * RAID.tierPowerShare)} battle power`);
      const invite = [...new Set(input.invite ?? [])].filter((u) => u !== uid);
      const names = await usernames(tx, [uid, ...invite]);
      await requireMutual(tx, uid, invite, names);
      let raid = unwrap(newRaid({ leader: uid, name: names[uid], weekId: week, tier: input.tier, now }));
      for (const other of invite) raid = unwrap(inviteToRaid(raid, uid, other, names[other], now));
      tx.set(ref, raid);
      return { raidId: id, raid };
    }

    const ref = raidRef(input.raidId);
    const snap = await tx.get(ref);
    // Someone who isn't part of it learns nothing about it.
    if (!snap.exists || !(snap.data() as RaidDoc).participants.includes(uid)) throw new HttpError(404, "That raid doesn't exist");
    const doc = snap.data() as RaidDoc;
    const save = (next: RaidDoc): RaidResponse => {
      if (next !== doc) tx.set(ref, next);
      return { raidId: input.raidId, raid: next };
    };

    switch (input.action) {
      case "invite": {
        if (doc.participants.includes(input.uid)) return save(doc);
        const names = await usernames(tx, [input.uid]);
        if (uid === doc.leader) await requireMutual(tx, uid, [input.uid], names);
        return save(unwrap(inviteToRaid(doc, uid, input.uid, names[input.uid], now)));
      }
      case "join": {
        if (doc.members.includes(uid)) return save(doc);
        const [me] = await loadFighters(tx, [uid], now);
        if (!me.hero) throw new HttpError(409, "Pick a class first");
        return save(unwrap(joinRaid(doc, uid, now)));
      }
      case "leave":
        return save(unwrap(leaveRaid(doc, uid, uid, now)));
      case "kick":
        return save(unwrap(leaveRaid(doc, uid, input.uid, now)));
      case "tier":
        return save(unwrap(setRaidTier(doc, uid, input.tier, now)));
      case "cancel":
        return save(unwrap(cancelRaid(doc, uid, now)));
      case "start": {
        // A retry after it went through finds it fought, and returns that fight.
        if (doc.status === "done") return save(doc);
        const fighters = await loadFighters(tx, doc.members, now);
        const leader = fighters.find((f) => f.uid === doc.leader)!;
        unwrap(canStartRaid(doc, uid, fightWeek(now, leader.state.timeZone)));
        const classless = fighters.find((f) => !f.hero);
        if (classless) throw new HttpError(409, `@${doc.names[classless.uid]} hasn't picked a class`);

        const members = fighters.map((f) => ({
          uid: f.uid,
          level: f.state.level,
          power: Math.round(f.hero!.battle.total * 10) / 10,
          // Each player's week turns in their own time zone.
          lastRaidWeek: raidedThisWeek(f.battle.raid?.weekId, now, f.state.timeZone) ? doc.weekId : null,
          hero: f.hero!.hero,
        }));
        const check = checkParty(members, doc.tier, doc.weekId);
        if (!check.allowed) {
          const [who, why] = Object.entries(check.problems)[0] ?? [];
          throw new HttpError(409, check.reason ?? `@${doc.names[who]}: ${why}`);
        }

        // The seed is made here, never by a client: the same party replays the same way from it.
        const seed = randomUUID();
        const outcome = runRaid({ weekId: doc.weekId, tier: doc.tier, members, seed });
        const records: RaidMemberRecord[] = [];
        for (const [i, f] of fighters.entries()) {
          const reward = outcome.rewards[i];
          const paid = applyFightRewards({
            state: f.state,
            outcome: { coins: reward.coins, scrap: reward.scrap, mythicCores: 0, drops: reward.drop ? [{ ...reward.drop, guaranteed: false }] : [] },
            fightId: `raid-${input.raidId}`,
            now,
            salvageBonus: f.salvageBonus,
          });
          const result = outcome.result.members[i];
          const item = paid.items[0];
          for (const made of paid.items) tx.create(f.r.inventory.doc(made.id), made.item satisfies Item);
          tx.set(f.r.state, paid.state);
          // One raid a week, win or lose, by the player's own fight week.
          tx.set(f.r.battle, { ...f.battle, raid: { weekId: fightWeek(now, f.state.timeZone) }, updatedAt: now } satisfies BattleDoc);
          tx.set(
            f.r.publicStats,
            { board: boardAfterFight(f.board, { week: fightWeek(now, f.state.timeZone), level: f.state.level, classId: f.state.classId!, rounds: [result.stats] }, now) },
            { merge: true },
          );
          records.push({
            uid: f.uid,
            name: doc.names[f.uid] ?? "player",
            classId: f.state.classId!,
            level: f.state.level,
            power: members[i].power,
            maxHp: result.maxHp,
            hpLeft: Math.round(result.hpLeft),
            downAt: result.downAt,
            stats: result.stats,
            coins: reward.coins,
            scrap: reward.scrap,
            lootEligible: reward.lootEligible,
            item: item ? { id: item.id, baseId: item.item.baseId, rarity: item.item.rarity, itemLevel: item.item.itemLevel } : null,
            salvaged: paid.salvaged[0] ?? null,
          });
        }
        const record: RaidRecord = {
          at: now,
          seed,
          bossId: outcome.encounter.boss.id,
          bossName: outcome.encounter.boss.name,
          tier: outcome.encounter.tier,
          won: outcome.result.won,
          end: outcome.result.end,
          seconds: outcome.result.seconds,
          foeMaxHp: outcome.result.foeMaxHp,
          foeHpLeft: Math.round(outcome.result.foeHpLeft),
          members: records,
          log: outcome.result.log,
        };
        return save(finishRaid(doc, record, now));
      }
    }
  });
}
