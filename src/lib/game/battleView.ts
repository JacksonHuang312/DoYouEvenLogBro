import { activePause } from "./breaks";
import { baseItem } from "./catalog";
import { energyOf, type GameState } from "./claim";
import type { FightEvent, FightTiming } from "./combat";
import {
  BOSS_TOWER,
  CAMPAIGN,
  CLASS_SWITCH,
  CLASSES,
  COMBAT,
  ENDLESS_TOWER,
  ENERGY,
  LEVEL_POINTS,
  STATS,
  type ClassId,
  type Rarity,
  type Stat,
} from "./config";
import type { MusclesFacts } from "./facts";
import {
  fightDay,
  fightHero,
  newBattleDoc,
  nextWeeklyReset,
  runFight,
  weeklyFor,
  type BattleDoc,
  type FightHero,
  type FightMode,
} from "./fights";
import { classCards, nextSwitchAt, type ClassCard } from "./heroClass";
import { equippedItems, type OwnedItem } from "./items";
import { pointsFree, pointsOf, pointsSpent } from "./levels";
import {
  bossTowerEncounter,
  campaignEncounter,
  checkMinimums,
  towerEncounter,
  weeklyEncounter,
  CAMPAIGN_STAGES,
  type Encounter,
} from "./bosses";
import { STAT_LABELS } from "./view";
import type { FightRecord } from "../server/fights";

/*
 * What the Battle screens show (GAME_DESIGN.md 7.2, 10 and 13): the four fight modes with the next
 * enemy, its stat minimums against the hero, cooldowns and energy; the class and stat point
 * panels; and a finished fight as headline, rounds, rewards and a readable log. Pure. Whether a
 * Fight button is on comes from a dry run of the server's own `runFight` on the same state, so the
 * reason shown under a disabled button is always the server's.
 */

const MIN_MS = 60 * 1000;

/** "3 h 20 m", "45 m", "under a minute". */
export function timeLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / MIN_MS));
  if (total < 1) return "under a minute";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h${m ? ` ${m} m` : ""}` : `${m} m`;
}

export interface MinimumRow {
  stat: Stat;
  label: string;
  needed: number;
  have: number;
  met: boolean;
  /** An injury flag on this stat waives the minimum. */
  waived: boolean;
}

export interface ModeCard {
  mode: FightMode;
  title: string;
  /** What the next fight is: a boss or the floor/stage, and its recommended power. */
  foe: string;
  /** The boss's epithet, or null for regular enemies. */
  epithet: string | null;
  /** "Brute", "Bleeder"...; null for regular enemies. */
  type: string | null;
  /** Recommended battle power, and the hero's as a share of it ("94% of recommended power"). */
  power: number;
  powerLine: string;
  /** Short facts under the title: tier, floor, wins, cooldown. */
  facts: string[];
  minimums: MinimumRow[];
  /** Energy a request spends. */
  energy: number;
  enabled: boolean;
  /** Why the Fight button is off, or null. */
  reason: string | null;
  /** Endless tower: the Climb button (up to ENDLESS_TOWER.autoClimbMax floors). */
  canClimb: boolean;
  /** Boss Tower: floors that can be fought, newest last (cleared ones are reclears). */
  floors: { floor: number; boss: string; reclear: boolean }[];
}

export interface BattleView {
  /** Null until a class is picked: the screen shows the picker instead. */
  classId: ClassId | null;
  className: string | null;
  classes: ClassCard[];
  energy: number;
  energyMax: number;
  power: number | null;
  paused: boolean;
  cards: ModeCard[];
  points: {
    free: number;
    spent: number;
    perStat: { stat: Stat; label: string; points: number; boostPct: number }[];
    respecCost: number;
    max: number;
  };
  classSwitch: { cost: number; enabled: boolean; reason: string | null };
}

const TYPE_LABEL = (t: string | undefined) =>
  t ? t[0].toUpperCase() + t.slice(1) : null;

function minimumRows(encounter: Encounter, f: FightHero): MinimumRow[] {
  if (!Object.keys(encounter.minimums).length) return [];
  const check = checkMinimums({
    minimums: encounter.minimums,
    power: encounter.power,
    stats: f.stats,
    heroPower: f.battle.total,
    injured: f.injured,
  });
  return check.rows.map((r) => ({
    stat: r.stat,
    label: STAT_LABELS[r.stat],
    needed: r.needed,
    have: r.have,
    met: r.met,
    waived: r.waived,
  }));
}

const powerLine = (hero: number, encounter: number) =>
  `Your power ${Math.round(hero)} · recommended ${encounter} (${Math.round((100 * hero) / encounter)}%)`;

export interface BattleInput {
  state: GameState | null;
  battle: BattleDoc | null;
  muscles: MusclesFacts;
  inventory: OwnedItem[];
  now: number;
  timeZone: string;
}

export function battleView({
  state,
  battle,
  muscles,
  inventory,
  now,
  timeZone,
}: BattleInput): BattleView {
  const game = state;
  const classId = game?.classId ?? null;
  const doc = battle ?? newBattleDoc(now);
  const level = game?.level ?? 1;
  const spent = game ? pointsSpent(game) : 0;
  const points = {
    free: game ? pointsFree(game) : 0,
    spent,
    respecCost: LEVEL_POINTS.respecCost,
    max: LEVEL_POINTS.maxPerStat,
    perStat: STATS.map((stat) => {
      const p = game ? (pointsOf(game)[stat] ?? 0) : 0;
      return {
        stat,
        label: STAT_LABELS[stat],
        points: p,
        boostPct: Math.round(p * LEVEL_POINTS.pctPerPoint * 1000) / 10,
      };
    }),
  };
  const switchAt = game ? nextSwitchAt(game, now) : null;
  const classSwitch = {
    cost: CLASS_SWITCH.cost,
    enabled:
      !!game &&
      !!classId &&
      switchAt == null &&
      game.coins >= CLASS_SWITCH.cost,
    reason:
      !game || !classId
        ? null
        : switchAt != null
          ? `Next switch in ${timeLeft(switchAt - now)}`
          : game.coins < CLASS_SWITCH.cost
            ? "Not enough coins"
            : null,
  };
  const base = {
    classId,
    className: classId ? CLASSES[classId].name : null,
    classes: classCards(),
    energy: game ? energyOf(game) : ENERGY.start,
    energyMax: ENERGY.max,
    paused: game ? activePause(game, now) != null : false,
    points,
    classSwitch,
  };
  if (!game || !classId) return { ...base, power: null, cards: [] };

  const hero = fightHero({
    state: game,
    muscles,
    worn: equippedItems(game, inventory),
    now,
  });
  if (!hero.ok) return { ...base, power: null, cards: [] };
  const f = hero.value;
  const attempt = (
    mode: FightMode,
    extra: { floor?: number; climb?: boolean } = {},
  ) =>
    runFight({
      mode,
      doc,
      state: game,
      fighter: f,
      now,
      timeZone,
      seed: "preview",
      ...extra,
    });
  const verdict = (r: ReturnType<typeof attempt>) => ({
    enabled: r.ok,
    reason: r.ok ? null : r.error,
  });
  const zone = game.timeZone || timeZone;
  const cards: ModeCard[] = [];

  // Weekly boss: the tier is locked by the week's first fight.
  {
    const weekly = weeklyFor(doc, level, f.battle.total, now, zone);
    const e = weeklyEncounter(weekly.weekId, weekly.tier);
    const fought = weekly.lastFightDay === fightDay(now, zone);
    cards.push({
      mode: "weekly",
      title: "Weekly boss",
      foe: e.foe.name,
      epithet: e.boss?.epithet ?? null,
      type: TYPE_LABEL(e.boss?.type),
      power: e.power,
      powerLine: powerLine(f.battle.total, e.power),
      facts: [
        `Tier ${weekly.tier} (locked for the week)`,
        `${weekly.wins} ${weekly.wins === 1 ? "win" : "wins"} in ${weekly.fights} ${weekly.fights === 1 ? "fight" : "fights"} this week`,
        fought
          ? `Next fight in ${timeLeft(nextWeeklyReset(now, zone) - now)}`
          : "One fight a day, resets 04:00",
      ],
      minimums: minimumRows(e, f),
      energy: 0,
      ...verdict(attempt("weekly")),
      canClimb: false,
      floors: [],
    });
  }

  // Endless tower: only the next floor.
  {
    const floor = doc.endless.cleared + 1;
    const e = towerEncounter(floor);
    const cool = doc.endless.cooldownUntil - now;
    cards.push({
      mode: "endless",
      title: "Endless tower",
      foe: e.foe.name,
      epithet: null,
      type: null,
      power: e.power,
      powerLine: powerLine(f.battle.total, e.power),
      facts: [
        `Floor ${floor} next (${doc.endless.cleared} cleared)`,
        cool > 0
          ? `Closed for ${timeLeft(cool)} after a loss`
          : `Climb fights up to ${ENDLESS_TOWER.autoClimbMax} floors`,
      ],
      minimums: [],
      energy: 1,
      ...verdict(attempt("endless")),
      canClimb: attempt("endless", { climb: true }).ok,
      floors: [],
    });
  }

  // Boss Tower: the next floor, or a cleared one again for a little gold.
  {
    const cleared = doc.bossTower.cleared;
    const top = Math.min(cleared + 1, BOSS_TOWER.floors);
    const e = bossTowerEncounter(top)!;
    const cool = doc.bossTower.cooldownUntil - now;
    cards.push({
      mode: "bossTower",
      title: "Boss Tower",
      foe: e.foe.name,
      epithet: e.boss?.epithet ?? null,
      type: TYPE_LABEL(e.boss?.type),
      power: e.power,
      powerLine: powerLine(f.battle.total, e.power),
      facts: [
        cleared >= BOSS_TOWER.floors
          ? "Every floor cleared"
          : `Floor ${top} of ${BOSS_TOWER.floors} next`,
        cool > 0
          ? `Closed for ${timeLeft(cool)}`
          : `${BOSS_TOWER.cooldownHours} h wait after any fight`,
      ],
      minimums: minimumRows(e, f),
      energy: 0,
      ...verdict(attempt("bossTower", { floor: top })),
      canClimb: false,
      floors: Array.from({ length: top }, (_, i) => ({
        floor: i + 1,
        boss: bossTowerEncounter(i + 1)!.foe.name,
        reclear: i + 1 <= cleared,
      })),
    });
  }

  // Campaign: the next stage.
  {
    const stage = doc.campaign.cleared + 1;
    const e = campaignEncounter(Math.min(stage, CAMPAIGN_STAGES))!;
    cards.push({
      mode: "campaign",
      title: "Campaign",
      foe: e.foe.name,
      epithet: e.boss?.epithet ?? null,
      type: TYPE_LABEL(e.boss?.type),
      power: e.power,
      powerLine: powerLine(f.battle.total, e.power),
      facts: [
        stage > CAMPAIGN_STAGES
          ? "Finished"
          : `Chapter ${e.chapter}, stage ${e.stageInChapter} of ${CAMPAIGN.stagesPerChapter}`,
        `${doc.campaign.cleared} of ${CAMPAIGN_STAGES} stages cleared`,
      ],
      minimums: minimumRows(e, f),
      energy: 1,
      ...verdict(attempt("campaign")),
      canClimb: false,
      floors: [],
    });
  }

  return { ...base, power: Math.round(f.battle.total), cards };
}

// ---- A finished fight ----

/**
 * Fight seconds per second shown (GAME_DESIGN.md 13.17). The simulation counts in its own seconds;
 * every time the player sees (cooldowns, timestamps, how long a fight lasted) is divided by this, so
 * the replay at 1× plays 1 second for 1 second. The rules and balance are untouched.
 */
export const FIGHT_TIME_SCALE = 2;

const fixed = (t: number) => `${t.toFixed(1)}s`;
const amt = (e: FightEvent) =>
  e.amount != null ? Math.round(e.amount).toLocaleString("en-US") : "";

/** One readable line per fight event, in time order. `foe` is the enemy's name. */
export function logLines(
  events: FightEvent[],
  foe: string,
  scale = 1,
): { t: string; text: string }[] {
  return events.map((e) => {
    const you = e.actor === "hero";
    const crit = e.crit ? " (critical)" : "";
    const name = e.name ?? "";
    let text: string;
    switch (e.action) {
      case "attack":
        text = you
          ? `You hit ${foe} for ${amt(e)}${crit}`
          : `${foe} hits you for ${amt(e)}${crit}`;
        break;
      case "skill":
      case "ultimate":
        text = you
          ? `${name || "Skill"}: ${amt(e) ? `${amt(e)}` : "used"}${crit}`
          : `${foe} uses ${name || "a skill"} for ${amt(e)}`;
        break;
      case "telegraph":
        text = `${foe} winds up a heavy blow`;
        break;
      case "heavy":
        text = `${foe} lands a heavy blow for ${amt(e)}`;
        break;
      case "bleed":
        text = `You bleed for ${amt(e)}`;
        break;
      case "heal":
        text = `${name ? `${name}: ` : ""}you heal ${amt(e)}`;
        break;
      case "shield":
        text = `${name ? `${name}: ` : ""}you gain a ${amt(e)} shield`;
        break;
      case "last-stand":
        text = "Last Stand: you survive on 1 HP";
        break;
      case "reflect":
        text = `You reflect ${amt(e)} back`;
        break;
      case "enrage":
        text = `${foe} enrages`;
        break;
      default:
        // The actor of a "down" event is whoever fell.
        text = you ? "You are down" : `${foe} is down`;
    }
    return { t: fixed(e.t / scale), text };
  });
}

export interface ResultItem {
  id: string;
  name: string;
  rarity: Rarity;
}

export interface ResultView {
  won: boolean;
  headline: string;
  sub: string;
  rounds: {
    title: string;
    won: boolean;
    seconds: string;
    power: string;
    ended: string;
  }[];
  rewards: { label: string; value: string }[];
  items: ResultItem[];
  salvaged: string[];
  /** A guarantee forced the drop. */
  guaranteed: boolean;
  /** The best rarity dropped, for how big the reveal is. */
  best: Rarity | null;
  log: { title: string; lines: { t: string; text: string }[] }[];
  energyLeft: number | null;
  /** What the replay plays, or null for fights stored before health was recorded. */
  replay: ReplayRound[] | null;
}

/** One round of a fight as the replay plays it: each event with both sides' health and the hero's ultimate charge right after it. */
export interface ReplayRound {
  foe: string;
  won: boolean;
  seconds: number;
  heroMax: number;
  foeMax: number;
  classId: ClassId;
  /** In shown seconds (fight seconds / FIGHT_TIME_SCALE). */
  timing: FightTiming;
  /** The lowest and highest hit of each action this round (crits left out), by cooldown row key. */
  damage: Partial<Record<string, { min: number; max: number }>>;
  events: {
    t: number;
    text: string;
    actor: "hero" | "foe";
    action: FightEvent["action"];
    hh: number;
    fh: number;
    en: number;
  }[];
}

/** The replay's rounds, or null when any round lacks what the replay needs (fights stored before it existed). */
export function replayRounds(
  rounds: FightRecord["rounds"],
  classId: ClassId,
): ReplayRound[] | null {
  const out: ReplayRound[] = [];
  for (const r of rounds) {
    const { heroMaxHp, foeMaxHp, timing, log } = r.result;
    if (
      !heroMaxHp ||
      !foeMaxHp ||
      !timing ||
      log.some((e) => e.hh == null || e.fh == null || e.en == null)
    )
      return null;
    const lines = logLines(log, r.foe);
    const S = FIGHT_TIME_SCALE;
    const per = (cd: { every: number; first: number }) => ({
      every: cd.every / S,
      first: cd.first / S,
    });
    const damage: ReplayRound["damage"] = {};
    const seen = (key: string, e: FightEvent) => {
      if (!e.amount || e.crit) return;
      const d = damage[key];
      damage[key] = {
        min: Math.min(d?.min ?? Infinity, e.amount),
        max: Math.max(d?.max ?? 0, e.amount),
      };
    };
    for (const e of log) {
      if (
        e.actor === "hero" &&
        (e.action === "attack" ||
          e.action === "skill" ||
          e.action === "ultimate")
      )
        seen(e.action, e);
      else if (e.actor === "foe" && e.action === "attack") seen("foeAttack", e);
      else if (e.actor === "foe" && e.action === "heavy") seen("foeHeavy", e);
    }
    out.push({
      foe: r.foe,
      won: r.result.won,
      seconds: r.result.seconds / S,
      heroMax: heroMaxHp,
      foeMax: foeMaxHp,
      classId,
      timing: {
        attack: per(timing.attack),
        skill: per(timing.skill),
        foeAttack: per(timing.foeAttack),
        foeHeavy: timing.foeHeavy
          ? { ...per(timing.foeHeavy), warn: timing.foeHeavy.warn / S }
          : null,
      },
      damage,
      events: log.map((e, i) => ({
        t: e.t / S,
        text: lines[i].text,
        actor: e.actor,
        action: e.action,
        hh: e.hh!,
        fh: e.fh!,
        en: e.en!,
      })),
    });
  }
  return out;
}

/** The replay's state `clock` seconds into a round: both health values and the latest few lines. */
export function replayAt(
  round: ReplayRound,
  clock: number,
  show = 4,
): { hh: number; fh: number; lines: string[] } {
  const seen = round.events.filter((e) => e.t <= clock);
  const last = seen.at(-1);
  return {
    hh: last?.hh ?? round.heroMax,
    fh: last?.fh ?? round.foeMax,
    lines: seen.slice(-show).map((e) => e.text),
  };
}

const END_TEXT = {
  "foe-down": "Defeated it",
  "hero-down": "You fell",
  enrage: "It enraged",
} as const;
const RANK: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
];
const TITLE: Record<FightMode, string> = {
  weekly: "Weekly boss",
  endless: "Endless tower",
  bossTower: "Boss Tower",
  campaign: "Campaign",
};

/** A fight record as the result screen shows it. `energy` is what's left, when the response said. */
export function resultView(
  fight: FightRecord,
  energy: number | null = null,
): ResultView {
  const won = fight.won;
  const rounds = fight.rounds;
  const wins = rounds.filter((r) => r.result.won).length;
  const items: ResultItem[] = fight.items.map((i) => ({
    id: i.id,
    name: baseItem(i.baseId)?.name ?? "Unknown item",
    rarity: i.rarity,
  }));
  const rewards: ResultView["rewards"] = [];
  if (fight.coins)
    rewards.push({
      label: "Coins",
      value: `+${fight.coins.toLocaleString("en-US")}`,
    });
  if (fight.scrap)
    rewards.push({
      label: "Scrap",
      value: `+${fight.scrap.toLocaleString("en-US")}`,
    });
  if (fight.mythicCores)
    rewards.push({ label: "Mythic Core", value: `+${fight.mythicCores}` });
  const dropped = [
    ...items.map((i) => i.rarity),
    ...fight.salvaged.map((s) => s.rarity),
  ];
  const best = dropped.length
    ? dropped.reduce((a, b) => (RANK.indexOf(b) > RANK.indexOf(a) ? b : a))
    : null;
  const multi = rounds.length > 1;
  const headline = multi
    ? wins === rounds.length
      ? "Climbed"
      : wins
        ? "Climb stopped"
        : "Defeat"
    : won
      ? "Victory"
      : "Defeat";
  const sub = multi
    ? `${TITLE[fight.mode]} · ${wins} of ${rounds.length} floors cleared`
    : `${TITLE[fight.mode]} · ${rounds[0].foe}${fight.firstClear === false ? " · cleared before" : ""}`;
  return {
    won,
    headline,
    sub,
    rounds: rounds.map((r) => ({
      title: r.foe,
      won: r.result.won,
      seconds: fixed(r.result.seconds / FIGHT_TIME_SCALE),
      power: `${Math.round(fight.heroPower)} vs ${r.power}`,
      ended: END_TEXT[r.result.end],
    })),
    rewards,
    items,
    salvaged: fight.salvaged.map(
      (s) =>
        `${baseItem(s.baseId)?.name ?? "Item"} (duplicate) → ${s.scrap} scrap`,
    ),
    guaranteed: fight.guaranteed,
    best,
    log: rounds.map((r) => ({
      title: r.foe,
      lines: logLines(r.result.log, r.foe, FIGHT_TIME_SCALE),
    })),
    energyLeft: energy,
    replay: replayRounds(rounds, fight.classId),
  };
}

/** What the replay's action icon draws. */
export type ActionIconId =
  | "slash"
  | "guard"
  | "powerStrike"
  | "mend"
  | "bastion"
  | "execution"
  | "radiance"
  | "claw"
  | "heavy";

export interface CooldownRow {
  side: "you" | "foe";
  /** Stable key for the row. */
  key: string;
  label: string;
  icon: ActionIconId;
  /** 0 just used, 1 ready. */
  fill: number;
  /** The lowest and highest hit it lands this fight ("38–46"), when it deals damage. */
  range?: string;
  /** The enemy's big hit is winding up. */
  warn?: boolean;
}

const SKILL_ICON: Record<ClassId, ActionIconId> = {
  vanguard: "guard",
  striker: "powerStrike",
  cleric: "mend",
};
const ULT_ICON: Record<ClassId, ActionIconId> = {
  vanguard: "bastion",
  striker: "execution",
  cleric: "radiance",
};

/** How ready each action is `clock` seconds into a round: the hero's attack, skill and ultimate, the enemy's attack and big hit. */
export function replayCooldowns(
  round: ReplayRound,
  clock: number,
): CooldownRow[] {
  const { timing, classId } = round;
  const seen = round.events.filter((e) => e.t <= clock);
  const lastAt = (actor: "hero" | "foe", action: FightEvent["action"]) =>
    seen.findLast((e) => e.actor === actor && e.action === action)?.t;
  /** Time since the last use as a share of the cooldown; before the first use, since the fight began. */
  const ready = (
    cd: { every: number; first: number },
    last: number | undefined,
  ) =>
    Math.max(
      0,
      Math.min(1, (clock - (last ?? cd.first - cd.every)) / cd.every),
    );
  const cls = CLASSES[classId];
  const charge = seen.at(-1)?.en ?? 0;
  const rangeOf = (key: string) => {
    const d = round.damage[key];
    return d
      ? {
          range:
            d.min === d.max
              ? `${Math.round(d.max)}`
              : `${Math.round(d.min)}–${Math.round(d.max)}`,
        }
      : {};
  };
  const rows: CooldownRow[] = [
    {
      side: "you",
      key: "attack",
      label: "Attack",
      icon: "slash",
      fill: ready(timing.attack, lastAt("hero", "attack")),
      ...rangeOf("attack"),
    },
    {
      side: "you",
      key: "skill",
      label: cls.skill.name,
      icon: SKILL_ICON[classId],
      fill: ready(timing.skill, lastAt("hero", "skill")),
      ...rangeOf("skill"),
    },
    {
      side: "you",
      key: "ultimate",
      label: cls.ultimate.name,
      icon: ULT_ICON[classId],
      fill: Math.min(1, charge / COMBAT.energy.full),
      ...rangeOf("ultimate"),
    },
    {
      side: "foe",
      key: "foeAttack",
      label: "Attack",
      icon: "claw",
      fill: ready(timing.foeAttack, lastAt("foe", "attack")),
      ...rangeOf("foeAttack"),
    },
  ];
  if (timing.foeHeavy) {
    const lastHeavy = lastAt("foe", "heavy");
    const lastWarn = lastAt("foe", "telegraph");
    rows.push({
      side: "foe",
      key: "foeHeavy",
      label: "Heavy blow",
      icon: "heavy",
      fill: ready(timing.foeHeavy, lastHeavy),
      ...rangeOf("foeHeavy"),
      warn: lastWarn != null && (lastHeavy == null || lastWarn > lastHeavy),
    });
  }
  return rows;
}
