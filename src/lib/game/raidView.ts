import { baseItem } from "./catalog";
import { FIGHT_TIME_SCALE } from "./battleView";
import { CLASSES, RAID, type Rarity } from "./config";
import { fightWeek } from "./fights";
import type { PartyEvent } from "./party";
import type { RaidDoc, RaidRecord } from "./raidLobby";
import { raidBoss, raidedThisWeek, raidTierFor, RAID_TIERS } from "./raids";

/*
 * What the raid screens show (GAME_DESIGN.md 13.32): the Raid card on the Battle tab, the lobby and
 * the result. Pure. Whether a party may really start is the server's call (it reads everyone's
 * level and power, which other players can't); the lobby shows the server's reason when it refuses.
 */

export type StoredRaid = RaidDoc & { id: string };

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const num = (n: number) => Math.round(n).toLocaleString("en-US");
const minPower = (tier: number) => Math.ceil(RAID.tierPower[tier - 1] * RAID.tierPowerShare);
const TYPE_NOTE: Record<string, string> = {
  plain: "No tricks",
  brute: "Big telegraphed hits",
  bleeder: "Bleeds the party",
  timer: "Enrages early: it has to die fast",
  mixed: "Big hits, bleeding and an early enrage",
};

export interface LobbyRow {
  uid: string;
  name: string;
  role: "Leader" | "Joined" | "Invited";
  you: boolean;
}

export interface LobbyView {
  id: string;
  isLeader: boolean;
  tier: number;
  /** "Tier 2 · level 40 and 220 battle power each". */
  tierLine: string;
  rows: LobbyRow[];
  /** Places left to invite into. */
  spots: number;
  /** Whether the Start button is on: the leader, with at least two joined. */
  canStart: boolean;
  /** Under the Start button: why it is off, or what happens to people who haven't answered. */
  note: string | null;
}

export interface RaidCardView {
  weekId: string;
  boss: { name: string; epithet: string; type: string; note: string; bestWith: number };
  /** The highest tier the player may enter, 0 when none. */
  topTier: number;
  /** Why the player can't raid at all yet, or null. */
  locked: string | null;
  /** The tiers the player can pick when making a party. */
  tiers: { tier: number; label: string }[];
  /** This week's raid is used up. */
  used: boolean;
  facts: string[];
  /** The player's open party this week (as leader or member), if any. */
  lobby: LobbyView | null;
  /** Open parties that have asked the player. */
  invitations: { id: string; leader: string; tier: number; line: string }[];
  /** The player's most recent fought raid, to open its result. */
  last: { id: string; line: string; won: boolean } | null;
}

function lobbyView(raid: StoredRaid, uid: string): LobbyView {
  const isLeader = raid.leader === uid;
  const rows: LobbyRow[] = [
    ...raid.members.map((u): LobbyRow => ({ uid: u, name: raid.names[u] ?? "player", role: u === raid.leader ? "Leader" : "Joined", you: u === uid })),
    ...raid.invited.map((u): LobbyRow => ({ uid: u, name: raid.names[u] ?? "player", role: "Invited", you: u === uid })),
  ];
  const enough = raid.members.length >= RAID.minParty;
  const waiting = raid.invited.length;
  const note = !isLeader
    ? "The leader starts the raid. You'll find the result here afterwards."
    : !enough
      ? `A raid needs at least ${RAID.minParty} players. Wait for someone to join.`
      : waiting > 0
        ? `${waiting === 1 ? "1 player hasn't" : `${waiting} players haven't`} answered. Starting now leaves them out.`
        : null;
  return {
    id: raid.id,
    isLeader,
    tier: raid.tier,
    tierLine: `Tier ${raid.tier} · level ${RAID.tierLevels[raid.tier - 1]} and ${minPower(raid.tier)} battle power each`,
    rows,
    spots: Math.max(0, RAID.maxParty - raid.participants.length),
    canStart: isLeader && enough,
    note,
  };
}

/** The Raid card: this week's boss, what the player may enter, their party, their invitations and their last result. */
export function raidCardView({
  uid,
  level,
  power,
  lastRaidWeek,
  raids,
  now,
  timeZone,
}: {
  uid: string;
  level: number;
  /** Battle power, or null while it is loading. */
  power: number | null;
  lastRaidWeek: string | null | undefined;
  raids: StoredRaid[];
  now: number;
  timeZone: string;
}): RaidCardView {
  const weekId = fightWeek(now, timeZone);
  const entry = raidBoss(weekId);
  const topTier = power == null ? 0 : raidTierFor(level, power);
  const used = raidedThisWeek(lastRaidWeek, now, timeZone);
  const locked =
    power == null || topTier > 0
      ? null
      : level < RAID.tierLevels[0]
        ? `Raids open at level ${RAID.tierLevels[0]}`
        : `Raids need ${minPower(1)} battle power`;
  const newest = (a: StoredRaid, b: StoredRaid) => b.createdAt - a.createdAt || a.id.localeCompare(b.id);
  const open = raids.filter((r) => r.status === "open" && r.weekId === weekId).sort(newest);
  const mine = open.find((r) => r.members.includes(uid)) ?? null;
  const done = raids.filter((r) => r.status === "done" && r.outcome && r.members.includes(uid)).sort((a, b) => b.outcome!.at - a.outcome!.at);
  const last = done[0];
  return {
    weekId,
    boss: { name: entry.name, epithet: entry.epithet, type: cap(entry.type), note: `${TYPE_NOTE[entry.type]}${entry.cleave ? ", on the whole party" : ""}`, bestWith: entry.bestWith },
    topTier,
    locked,
    tiers: Array.from({ length: Math.min(topTier, RAID_TIERS) }, (_, i) => ({
      tier: i + 1,
      label: `Tier ${i + 1} · level ${RAID.tierLevels[i]} · ${minPower(i + 1)}+ power · ${RAID.coins[i]} coins`,
    })),
    used,
    facts: [
      `${RAID.minParty} to ${RAID.maxParty} players who follow each other, within ${RAID.levelBand} levels`,
      `Best with ${entry.bestWith} · the boss grows with the party`,
      used ? "You've raided this week. A new boss comes Sunday at 4 AM" : "One raid a week, win or lose",
    ],
    lobby: mine ? lobbyView(mine, uid) : null,
    invitations: used
      ? []
      : open
          .filter((r) => r.invited.includes(uid))
          .map((r) => ({ id: r.id, leader: r.names[r.leader] ?? "player", tier: r.tier, line: `Tier ${r.tier} · ${r.members.length} joined` })),
    last: last ? { id: last.id, line: `${last.outcome!.won ? "Victory" : "Defeat"} · ${last.outcome!.bossName} · tier ${last.outcome!.tier}`, won: last.outcome!.won } : null,
  };
}

// ---- The result ----

export interface RaidResultRow {
  uid: string;
  name: string;
  you: boolean;
  /** "Level 60 Striker · 360 power". */
  detail: string;
  dealt: string;
  absorbed: string;
  healed: string;
  /** "Standing · 320 / 900 HP" or "Down at 12.3s". */
  status: string;
  down: boolean;
  /** "+150 coins · +30 scrap", or "" on a loss. */
  pay: string;
  /** The item won, a salvaged drop, or why there was no roll. Null when there is nothing to say. */
  loot: { text: string; rarity: Rarity | null } | null;
}

export interface RaidResultView {
  won: boolean;
  headline: string;
  sub: string;
  boss: string;
  /** "Defeated it in 24.5s", "The party fell after 18.0s", "It enraged at 30.0s". */
  ended: string;
  rows: RaidResultRow[];
  log: { t: string; text: string }[];
}

const secs = (t: number) => `${(t / FIGHT_TIME_SCALE).toFixed(1)}s`;
const RARITY_NAME = (r: Rarity) => cap(r);

/** One readable line per raid event. `names[i]` is member i as the reader sees them ("You" or "@ann"). */
export function raidLogLines(events: PartyEvent[], names: string[], viewer: number, foe: string): { t: string; text: string }[] {
  const who = (i: number | undefined) => (i == null ? "" : names[i]);
  return events.map((e) => {
    const amount = e.amount != null ? num(e.amount) : "";
    const crit = e.crit ? " (critical)" : "";
    const isYou = e.actor === viewer;
    const v = (you: string, other: string) => (isYou ? you : other);
    let text: string;
    if (e.actor === "foe") {
      const target = who(e.target);
      const targetIsYou = e.target === viewer;
      switch (e.action) {
        case "attack":
          text = `${foe} hits ${targetIsYou ? "you" : target} for ${amount}`;
          break;
        case "heavy":
          text = `${foe} lands a heavy blow on ${targetIsYou ? "you" : target} for ${amount}`;
          break;
        case "telegraph":
          text = `${foe} winds up a heavy blow`;
          break;
        case "bleed":
          text = `${targetIsYou ? "You bleed" : `${target} bleeds`} for ${amount}`;
          break;
        case "enrage":
          text = `${foe} enrages`;
          break;
        default:
          text = `${foe} is down`;
      }
    } else {
      const me = who(e.actor);
      const name = e.name ?? "";
      switch (e.action) {
        case "attack":
          text = `${me} ${v("hit", "hits")} ${foe} for ${amount}${crit}`;
          break;
        case "skill":
        case "ultimate":
          text = amount ? `${me}: ${name || "Skill"} for ${amount}${crit}` : `${me} ${v("use", "uses")} ${name || "a skill"}${e.target != null ? ` on ${e.target === viewer ? "you" : who(e.target)}` : ""}`;
          break;
        case "heal": {
          const on = e.target == null ? (isYou ? "yourself" : "themself") : e.target === viewer ? "you" : who(e.target);
          text = `${me} ${v("heal", "heals")} ${on} for ${amount}${name ? ` (${name})` : ""}`;
          break;
        }
        case "shield":
          text = `${me} ${v("gain", "gains")} a ${amount} shield`;
          break;
        case "last-stand":
          text = `Last Stand: ${me} ${v("survive", "survives")} on 1 HP`;
          break;
        case "reflect":
          text = `${me} ${v("reflect", "reflects")} ${amount} back`;
          break;
        default:
          text = `${me} ${v("are", "is")} down`;
      }
    }
    return { t: secs(e.t), text };
  });
}

/** A fought raid as its result screen shows it to `uid`. */
export function raidResultView(record: RaidRecord, uid: string): RaidResultView {
  const viewer = record.members.findIndex((m) => m.uid === uid);
  const names = record.members.map((m, i) => (i === viewer ? "You" : `@${m.name}`));
  const rows = record.members.map((m, i): RaidResultRow => {
    let loot: RaidResultRow["loot"] = null;
    if (m.item) loot = { text: `${baseItem(m.item.baseId)?.name ?? "Item"} · ${RARITY_NAME(m.item.rarity)} · Level ${m.item.itemLevel}`, rarity: m.item.rarity };
    else if (m.salvaged) loot = { text: `${baseItem(m.salvaged.baseId)?.name ?? "Item"} (${RARITY_NAME(m.salvaged.rarity)}) auto-salvaged → +${m.salvaged.scrap} scrap`, rarity: null };
    else if (record.won && !m.lootEligible) loot = { text: `No loot roll: under ${Math.round(RAID.minContributionShare * 100)}% of the party's power`, rarity: null };
    return {
      uid: m.uid,
      name: i === viewer ? `@${m.name} (you)` : `@${m.name}`,
      you: i === viewer,
      detail: `Level ${m.level} ${CLASSES[m.classId].name} · ${num(m.power)} power`,
      dealt: num(m.stats.dealt),
      absorbed: num(m.stats.absorbed),
      healed: num(m.stats.healed),
      status: m.downAt != null ? `Down at ${secs(m.downAt)}` : `Standing · ${num(m.hpLeft)} / ${num(m.maxHp)} HP`,
      down: m.downAt != null,
      pay: m.coins || m.scrap ? `+${num(m.coins)} coins · +${num(m.scrap)} scrap` : "",
      loot,
    };
  });
  const ended = record.end === "foe-down" ? `Defeated it in ${secs(record.seconds)}` : record.end === "enrage" ? `It enraged at ${secs(record.seconds)}` : `The party fell after ${secs(record.seconds)}`;
  return {
    won: record.won,
    headline: record.won ? "Victory" : "Defeat",
    sub: `Raid · tier ${record.tier} · ${record.members.length} players`,
    boss: record.bossName,
    ended,
    rows,
    log: raidLogLines(record.log, names, viewer, record.bossName),
  };
}
