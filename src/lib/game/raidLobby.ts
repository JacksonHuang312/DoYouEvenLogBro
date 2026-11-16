import { RAID, type ClassId, type Rarity } from "./config";
import { fail, ok, type GameResult } from "./items";
import type { MemberResult, PartyEvent, PartyResult } from "./party";
import { RAID_TIERS } from "./raids";

/*
 * The raid lobby (GAME_DESIGN.md 13.10 and 13.31): a party is made by its leader, who invites
 * people; they join or decline; the leader starts, the server fights once and the result is stored
 * on the same document. Pure: each action returns the next document or why it isn't allowed. Who
 * may be invited (mutual follows) and whether the party may start (`checkParty`) are checked by
 * the server with what it reads.
 */

/** One member's part in a finished raid. */
export interface RaidMemberRecord {
  uid: string;
  name: string;
  classId: ClassId;
  level: number;
  /** Battle power going in. */
  power: number;
  maxHp: number;
  hpLeft: number;
  downAt: number | null;
  stats: MemberResult["stats"];
  coins: number;
  scrap: number;
  /** Whether their power was a big enough share of the party's for a loot roll. */
  lootEligible: boolean;
  /** The item they won, now in their inventory. */
  item: { id: string; baseId: string; rarity: Rarity; itemLevel: number } | null;
  /** A drop their auto-salvage setting turned into scrap. */
  salvaged: { baseId: string; rarity: Rarity; itemLevel: number; scrap: number } | null;
}

/** A finished raid: the fight and what everyone was paid. */
export interface RaidRecord {
  at: number;
  seed: string;
  bossId: string;
  bossName: string;
  tier: number;
  won: boolean;
  end: PartyResult["end"];
  seconds: number;
  foeMaxHp: number;
  foeHpLeft: number;
  /** In fight order (the party's order). */
  members: RaidMemberRecord[];
  log: PartyEvent[];
}

/** raids/{leaderUid}_{weekId}. Written only by the server; its participants can read it. */
export interface RaidDoc {
  leader: string;
  /** The leader's fight week when it was made. It can only start in that week. */
  weekId: string;
  tier: number;
  /** Who has joined, the leader first, in the order they will fight. */
  members: string[];
  /** Who has been asked and hasn't answered. */
  invited: string[];
  /** Members and invited together: who may read the document, and what the list query matches. */
  participants: string[];
  /** Usernames, for the lobby and the result. */
  names: Record<string, string>;
  status: "open" | "done" | "cancelled";
  createdAt: number;
  updatedAt: number;
  /** Set when it has been fought. */
  outcome?: RaidRecord;
}

/** One raid per leader per week, so a second tap can't make two. */
export const raidId = (leader: string, weekId: string) => `${leader}_${weekId}`;

const withPeople = (doc: RaidDoc, members: string[], invited: string[], now: number): RaidDoc => ({
  ...doc,
  members,
  invited,
  participants: [...members, ...invited],
  updatedAt: now,
});

const open = (doc: RaidDoc): GameResult<RaidDoc> =>
  doc.status === "done" ? fail("That raid has already been fought") : doc.status === "cancelled" ? fail("That raid was cancelled") : ok(doc);

/** A new party of one: its leader, with nobody invited yet. */
export function newRaid({ leader, name, weekId, tier, now }: { leader: string; name: string; weekId: string; tier: number; now: number }): GameResult<RaidDoc> {
  if (!Number.isInteger(tier) || tier < 1 || tier > RAID_TIERS) return fail("Unknown raid tier");
  return ok({
    leader,
    weekId,
    tier,
    members: [leader],
    invited: [],
    participants: [leader],
    names: { [leader]: name },
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
}

/** The leader asks someone. Already asked or joined changes nothing. The party, asked and joined, never exceeds RAID.maxParty. */
export function inviteToRaid(doc: RaidDoc, by: string, uid: string, name: string, now: number): GameResult<RaidDoc> {
  const check = open(doc);
  if (!check.ok) return check;
  if (by !== doc.leader) return fail("Only the leader can invite");
  if (uid === doc.leader) return fail("You're already in your own party");
  if (doc.participants.includes(uid)) return ok(doc);
  if (doc.participants.length >= RAID.maxParty) return fail(`A raid takes at most ${RAID.maxParty} players`);
  return ok({ ...withPeople(doc, doc.members, [...doc.invited, uid], now), names: { ...doc.names, [uid]: name } });
}

/** Someone who was asked joins. Joining twice changes nothing. */
export function joinRaid(doc: RaidDoc, uid: string, now: number): GameResult<RaidDoc> {
  const check = open(doc);
  if (!check.ok) return check;
  if (doc.members.includes(uid)) return ok(doc);
  if (!doc.invited.includes(uid)) return fail("You haven't been invited to that raid", 404);
  return ok(withPeople(doc, [...doc.members, uid], doc.invited.filter((u) => u !== uid), now));
}

/**
 * Someone leaves, declines, or is removed by the leader (`by`). The leader can't leave their own
 * party: they cancel it. Removing someone who isn't there changes nothing.
 */
export function leaveRaid(doc: RaidDoc, by: string, uid: string, now: number): GameResult<RaidDoc> {
  const check = open(doc);
  if (!check.ok) return check;
  if (by !== uid && by !== doc.leader) return fail("Only the leader can remove someone");
  if (uid === doc.leader) return fail("The leader can't leave. Cancel the raid instead");
  if (!doc.participants.includes(uid)) return ok(doc);
  const names = { ...doc.names };
  delete names[uid];
  return ok({ ...withPeople(doc, doc.members.filter((u) => u !== uid), doc.invited.filter((u) => u !== uid), now), names });
}

/** The leader calls it off. Cancelling twice changes nothing. */
export function cancelRaid(doc: RaidDoc, by: string, now: number): GameResult<RaidDoc> {
  if (doc.status === "cancelled") return ok(doc);
  if (doc.status === "done") return fail("That raid has already been fought");
  if (by !== doc.leader) return fail("Only the leader can cancel");
  return ok({ ...doc, status: "cancelled", updatedAt: now });
}

/** The leader changes the tier before starting. */
export function setRaidTier(doc: RaidDoc, by: string, tier: number, now: number): GameResult<RaidDoc> {
  const check = open(doc);
  if (!check.ok) return check;
  if (by !== doc.leader) return fail("Only the leader can change the tier");
  if (!Number.isInteger(tier) || tier < 1 || tier > RAID_TIERS) return fail("Unknown raid tier");
  return ok(tier === doc.tier ? doc : { ...doc, tier, updatedAt: now });
}

/**
 * Whether `by` may press Start now, before the party itself is checked: the leader, an open raid,
 * still in the week it was made for, and nobody still deciding isn't a blocker (they are left out).
 */
export function canStartRaid(doc: RaidDoc, by: string, weekNow: string): GameResult<RaidDoc> {
  const check = open(doc);
  if (!check.ok) return check;
  if (by !== doc.leader) return fail("Only the leader can start the raid");
  if (doc.weekId !== weekNow) return fail("The week has turned. Cancel this raid and make a new one");
  return ok(doc);
}

/** The document once fought: the outcome stored, and anyone still only invited dropped. */
export function finishRaid(doc: RaidDoc, outcome: RaidRecord, now: number): RaidDoc {
  const names = Object.fromEntries(doc.members.map((u) => [u, doc.names[u] ?? ""]));
  return { ...withPeople(doc, doc.members, [], now), names, status: "done", outcome };
}
