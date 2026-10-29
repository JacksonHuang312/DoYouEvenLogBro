/**
 * Every tunable number in the game (GAME_DESIGN.md). Logic in src/lib/game/ reads from here and
 * never hard-codes values, so rebalancing is a config change, not a data migration.
 */

export const STATS = ["chest", "back", "shoulders", "arms", "legs", "core"] as const;
export type Stat = (typeof STATS)[number];

/**
 * The 17 sub-muscles (the `muscle` values in src/data/exercises.json), grouped by stat. A stat is
 * the sum of its sub-muscles' points; the numbers are each sub-muscle's share of a typical stat,
 * used only to pick quest targets (minMuscleWeight). Section 2.1.
 */
export const STAT_MUSCLES = {
  chest: { chest: 1 },
  back: { lats: 0.4, "middle back": 0.4, "lower back": 0.2 },
  shoulders: { shoulders: 0.75, traps: 0.2, neck: 0.05 },
  arms: { triceps: 0.45, biceps: 0.4, forearms: 0.15 },
  legs: { quadriceps: 0.35, hamstrings: 0.3, calves: 0.15, glutes: 0.1, adductors: 0.05, abductors: 0.05 },
  core: { abdominals: 1 },
} as const satisfies Record<Stat, Record<string, number>>;

type ValuesOf<T> = T[keyof T];
export type SubMuscle = ValuesOf<{ [S in Stat]: keyof (typeof STAT_MUSCLES)[S] }>;

export const SUB_MUSCLES = STATS.flatMap((s) => Object.keys(STAT_MUSCLES[s])) as SubMuscle[];

/** Power = Σ(stat × multiplier). Legs and Back are the largest muscle groups; Core counts half. Section 2.5. */
export const POWER_MULTIPLIERS: Record<Stat, number> = {
  chest: 1,
  back: 1.2,
  shoulders: 1,
  arms: 1,
  legs: 1.2,
  core: 0.5,
};

// ---- Stat points (stat rework, section 10) ----

export const STAT_POINTS = {
  /** Points for a working set. */
  perSet: 1,
  /** Points for a working set of an exercise that beat your last session of it. */
  progressedSet: 1.25,
  /** A stat is its points divided by this. No cap. */
  perStat: 10,
  /** At most this many working sets per stat (muscle group) count in one workout; progressed sets first. */
  maxSetsPerStat: 8,
  /**
   * The weight step for "beat your last session". Workouts don't store the routine's rep range or
   * step, so stats use a fixed step (just under 5 lb) and a minimum of 1 rep: a replay of the
   * history always gives the same answer.
   */
  stepKg: 2.25,
};

/**
 * Training weeks kept per sub-muscle in game/muscles (for Iron Habit). Must cover
 * ACHIEVEMENTS.ironHabit.outOf.
 */
export const WEEKS_KEPT = 16;

/** Sets beyond these are treated as typos and ignored by the game. */
export const SANITY = { maxLoadKg: 600, maxReps: 100 };

// ---- Rep ranges and progression (section 9.2) ----

export const PROGRESSION = {
  /** A rep range's bounds: both ends are whole numbers in here, min at most max. */
  minReps: 1,
  maxReps: 30,
  /** The weight added when progressing, in the display unit, unless an exercise sets its own step. */
  defaultStep: { kg: 2.5, lb: 5 },
  /** Suggested weights are rounded to this much in the display unit, so conversions leave no stray decimals. */
  suggestionRounding: 0.5,
  /** Two loads this close (kg) count as the same weight. */
  sameWeightKg: 0.01,
};

// ---- Rust (stat rework, replaces decay) ----

/**
 * Stats never lose points. A stat untrained for `graceDays` days fights at reduced strength:
 * −perDay for each day from then on, at most `max`. Training any of its sub-muscles once clears it.
 * Pauses, and injury flags on that stat, stop the clock.
 */
export const RUST = {
  graceDays: 14,
  perDay: 0.01,
  max: 0.3,
};

// ---- Workouts, coins and XP (section 3) ----

/** A workout needs this many working sets (warm-ups and cardio excluded) to count. */
export const MIN_WORKING_SETS = 4;

/** Exercises in these categories never affect stats or count as working sets. */
export const EXCLUDED_CATEGORIES = ["cardio"];

/** A workout can't start more than this far in the future (clock skew allowance). */
export const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

export const COINS = {
  base: 50,
  /** Extra for doing a scheduled workout on its scheduled day. */
  scheduledBonus: 25,
  /** The scheduled bonus drops by this fraction per day off the scheduled day... */
  offDayPenaltyPerDay: 0.2,
  /** ...and is 0 when more than this many days off. */
  offDayMaxDays: 3,
  /** Most coins claims can pay in one day (the claim day, in the user's time zone). */
  dailyCap: 150,
  /** One-time grant to accounts that existed before the RPG (paid by the backfill script). */
  welcomeBonus: 500,
};

export const XP = {
  perWorkout: 20,
  /** Workout XP pays at most once per this many hours (claim time), matching the 2-a-day coin cap. Stat XP is unaffected. */
  workoutCooldownHours: 12,
  /** Per point of power above the highest power reached before. */
  perPowerPoint: 10,
  /** Flat, uncapped levels. Tuned so level 35 comes at about 2 years of 4 workouts a week (npm run pacing-table). */
  perLevel: 600,
};

/**
 * The steady player `npm run pacing-table` simulates (stat rework, section 10), and the design
 * doc's pacing targets in months. Only the table reads this; nothing in the game does.
 */
export const PACING = {
  workoutsPerWeek: 4,
  /** 16 working sets a workout, split like a typical push/pull/legs week. */
  setsPerStat: { chest: 3, back: 3.5, shoulders: 2.5, arms: 3, legs: 3, core: 1 } as Record<Stat, number>,
  /** Share of sets whose exercise beat its last session. */
  progressedShare: 0.15,
  /** Two of the three weekly quests claimed. */
  questXpPerWeek: 50,
  /** "Decent gear" [months, gear power]: early drops and shop buys, an Epic set at a year, a full Legendary set at two. */
  gearByMonth: [
    [0, 0],
    [3, 20],
    [6, 45],
    [12, 75],
    [18, 110],
    [24, 132],
    [36, 150],
  ] as [number, number][],
  /** Class bonus plus a title or two. */
  bonusPct: 0.08,
  targets: {
    weeklyTier: [0, null, 8, 14, 24] as (number | null)[],
    campaign: 9,
    bossTower: 30,
    level35: 24,
  },
};

// ---- Schedule (sections 3.2, 7.2) ----

export const SCHEDULE = {
  /**
   * A workout can fill a scheduled day this many days away (the off-day curve's reach, COINS.offDayMaxDays).
   * Also the most days after a scheduled day that a claim can still use it.
   */
  matchDays: COINS.offDayMaxDays,
  /** A workout done on its day but claimed the next day (sync delay) still pays in full. */
  syncGraceDays: 1,
  /** Schedule versions kept in game/schedule. A change starts tomorrow, so history never rewrites. */
  versionsKept: 10,
  /** Weeks of matched scheduled days kept (they stop mattering after matchDays). */
  matchedWeeksKept: 5,
};

// ---- Weekly quests (section 3.4) ----

export const QUESTS = {
  /** One reward per slot: weakest stat, weakest sub-muscle, consistency. About 100 coins a week. */
  rewards: [
    { coins: 30, xp: 25 },
    { coins: 30, xp: 25 },
    { coins: 40, xp: 25 },
  ],
  /** Working sets for the weakest-stat quest and the weakest-sub-muscle quest. */
  statSets: 12,
  muscleSets: 8,
  /** Consistency quests: distinct training days, or counted workouts. */
  daysTarget: 3,
  workoutsTarget: 4,
  /** "N scheduled workouts on their day": needs at least `scheduledMin` slots left this week; at most `scheduledMax`. */
  scheduledMin: 2,
  scheduledMax: 4,
  /** Core is ranked as if its score were divided by this, so it is picked less often. Matches its power multiplier. */
  coreWeight: POWER_MULTIPLIERS.core,
  /** Only sub-muscles weighing at least this much in their stat get a quest (never "neck"). */
  minMuscleWeight: 0.15,
  /** Rerolls pick randomly among this many of the weakest candidates. */
  rerollPool: 3,
  /** Coins for the first and second reroll of a week. */
  rerollCosts: [25, 50],
  /** A finished quest can still be claimed this many days after its week ends. */
  claimGraceDays: 3,
  /** Scrap paid with every claimed quest, on top of its coins and XP (a small salvage faucet). */
  scrapPerQuest: 5,
};

// ---- Pause mode and injury flags (section 3.6) ----

export const PAUSE = {
  minDays: 7,
  maxDays: 28,
  /** Days between the end of one pause and the start of the next. */
  cooldownDays: 14,
  /** Ended pauses are kept this long (rust needs them to stay frozen). */
  historyDays: 365,
};

export const INJURY = {
  maxStats: 2,
  expiryWeeks: 8,
  /** A flag can be renewed this many times (flags waive boss minimums, so they mustn't last forever). */
  maxRenewals: 2,
  /** A stat can be flagged again only this many days after its last flag ended (cleared or expired). */
  reflagWaitDays: 7,
  maxNoteLength: 200,
  historyDays: 365,
};

// ---- Items (sections 5 and 12) ----

export const ARMOR_SLOTS = ["helmet", "chestplate", "gloves", "leggings", "boots"] as const;
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];

/** Accessories are never part of a set. */
export const ACCESSORY_SLOTS = ["ring", "necklace", "belt", "charm"] as const;
export type AccessorySlot = (typeof ACCESSORY_SLOTS)[number];

/** What an item is for (item.slot). */
export const SLOTS = [...ARMOR_SLOTS, ...ACCESSORY_SLOTS] as const;
export type Slot = (typeof SLOTS)[number];
export const isAccessory = (slot: Slot): slot is AccessorySlot => (ACCESSORY_SLOTS as readonly string[]).includes(slot);

/** Where an item is worn (the keys of the equipped map). Rings and charms have two positions each. */
export const POSITIONS = ["helmet", "chestplate", "gloves", "leggings", "boots", "ring1", "ring2", "necklace", "belt", "charm1", "charm2"] as const;
export type Position = (typeof POSITIONS)[number];

/** The slot a position takes: "ring2" → "ring". */
export const slotOfPosition = (position: Position): Slot => position.replace(/\d$/, "") as Slot;
/** The positions an item of a slot can be worn in. */
export const positionsOf = (slot: Slot): Position[] => POSITIONS.filter((p) => slotOfPosition(p) === slot);

/** The combat attributes gear power splits into. */
export const ATTRIBUTES = ["hp", "atk", "def"] as const;
export type Attribute = (typeof ATTRIBUTES)[number];
/** A split of an item's power across attributes, in whole percents that add up to 100: { hp: 70, def: 30 }. */
export type Focus = Partial<Record<Attribute, number>>;

/** The rarity ladder, lowest first. */
export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"] as const;
export type Rarity = (typeof RARITIES)[number];

/** Items that start at one of these are named. Everything that starts below is unnamed. */
export const NAMED_RARITIES: readonly Rarity[] = ["legendary", "mythic"];

/** The rarities the shop sells. Legendary and Mythic only drop from bosses. */
export const SHOP_RARITIES = ["common", "uncommon", "rare", "epic"] as const;
export type ShopRarity = (typeof SHOP_RARITIES)[number];

/** Unnamed gear can be upgraded up to this rarity, never past it. */
export const UNNAMED_MAX_RARITY: Rarity = "legendary";

export const GEAR = {
  /** Power of one armor piece at +0. Full sets: Epic 75, Legendary 110. A Mythic is a single piece. */
  basePower: { common: 3, uncommon: 6, rare: 10, epic: 15, legendary: 22, mythic: 30 } as Record<Rarity, number>,
  /** Power of one accessory at +0: about 40% of an armor piece. */
  accessoryPower: { common: 1, uncommon: 2.5, rare: 4, epic: 6, legendary: 9, mythic: 12 } as Record<Rarity, number>,
  /** Each + step adds this fraction of the piece's base power. */
  plusStep: 0.04,
  maxPlus: 2,
  /**
   * A piece promoted into a named rarity (Epic → Legendary, Legendary → Mythic) has this share of
   * a native piece's power at the same plus, by plus (+0, +1, +2). A maxed one still loses to a fresh native.
   */
  ascendedFactor: [0.85, 0.885, 0.92],
  /** Gear's share of battle power is at most this: gear ≤ maxShare / (1 − maxShare) × body power. */
  maxShare: 0.3,
  /** The focus of an item that has none (older items, or a base that left the catalog): the slot's own split. */
  slotFocus: {
    helmet: { hp: 70, def: 30 },
    chestplate: { def: 70, hp: 30 },
    gloves: { atk: 70, hp: 30 },
    leggings: { hp: 70, atk: 30 },
    boots: { atk: 70, def: 30 },
    ring: { atk: 70, hp: 30 },
    necklace: { hp: 60, def: 40 },
    belt: { def: 70, hp: 30 },
    charm: { hp: 34, atk: 33, def: 33 },
  } as Record<Slot, Focus>,
};

/**
 * What an accessory's effect does (Phase 5 hook: nothing reads these in combat yet). `value` is
 * the effect at Legendary strength, scaled down below it by EFFECT_SCALE. No effect may change the
 * coins or XP earned (section 12).
 */
export const ACCESSORY_EFFECTS = {
  crit: { label: "Crit chance", value: 0.025 },
  healing: { label: "Healing", value: 0.03 },
  damageReduction: { label: "Damage reduction", value: 0.02 },
  /** Skill cooldown and time between basic attacks are this much shorter (not the ultimate). Replaces boss cooldown reduction. */
  haste: { label: "Haste", value: 0.05 },
  /** The ultimate's energy fills this much faster. */
  ultCharge: { label: "Ult charge", value: 0.075 },
  /** Heal this share of the damage you deal. */
  lifesteal: { label: "Lifesteal", value: 0.02 },
  /** Crits deal this much more than COMBAT.critMultiplier. */
  critDamage: { label: "Crit damage", value: 0.1 },
  /** Extra damage against an enemy under COMBAT.finisherBelowPct of its HP. */
  finisher: { label: "Finisher", value: 0.1 },
  /** Guard (Vanguard skill) lasts this much longer. */
  guardDuration: { label: "Guard duration", value: 0.125 },
  /** Bastion's shield (Vanguard ultimate) is this much bigger. */
  bastionShield: { label: "Bastion shield", value: 0.1 },
  /** Every physical hit taken deals this share of it back. */
  thorns: { label: "Thorns", value: 0.025 },
  /** Mend and Radiance heal this much more. */
  healPower: { label: "Heal power", value: 0.1 },
  /** Bleeding hurts this much less. */
  bleedResist: { label: "Bleed resistance", value: 0.075 },
  salvageYield: { label: "Salvage yield", value: 0.1 },
  rerollDiscount: { label: "Shop reroll discount", value: 0.15 },
} as const;
export type AccessoryEffect = keyof typeof ACCESSORY_EFFECTS;

/** An effect's strength by the item's current rarity, as a share of its Legendary value. */
export const EFFECT_SCALE: Record<Rarity, number> = { common: 0.2, uncommon: 0.4, rare: 0.6, epic: 0.8, legendary: 1, mythic: 1.25 };

/** Level needed to equip an item of each (current) rarity. */
export const EQUIP_LEVEL: Record<Rarity, number> = { common: 1, uncommon: 1, rare: 1, epic: 8, legendary: 15, mythic: 25 };

/**
 * Set bonuses: equipping this many pieces of one set multiplies gear power before the gear cap.
 * The highest reached applies (5 pieces is +20% in all, not +28%). The bonus multiplies only the power
 * of that set's own equipped pieces, and only the best equipped set counts. Not part of the bonus bucket.
 */
export const SET_BONUS = [
  { pieces: 3, gearPct: 0.08 },
  { pieces: 5, gearPct: 0.2 },
];

/** Titles and class bonuses add up in one bucket, capped here, that multiplies battle power. */
export const BONUS_BUCKET_CAP = 0.25;

// ---- Shop, selling and salvage (sections 5, 10 and 12) ----

/** What an item of each rarity is worth before the shop's markup. */
export const ITEM_VALUE: Record<ShopRarity, number> = { common: 150, uncommon: 450, rare: 1000, epic: 2500 };

export const SHOP = {
  /** The shop charges the value plus this (150 → 190, 450 → 565, 1000 → 1250, 2500 → 3125). */
  markup: 0.25,
  /** Shop and sell prices are rounded to this many coins. */
  roundTo: 5,
  /** Offers in a week's stock. */
  offers: 6,
  /** Relative chance of each rarity per offer. */
  rarityWeights: { common: 35, uncommon: 35, rare: 20, epic: 10 } as Record<ShopRarity, number>,
  /** At most this many Epic offers in one stock. */
  maxEpic: 1,
  /** Each offer is an accessory with this chance, otherwise armor. */
  accessoryShare: 0.3,
  /** Coins for the first and second reroll of a week. */
  rerollCosts: [100, 200],
};

/** Unnamed items sell for this share of their origin rarity's value (pre-markup). Named items can't be sold. */
export const SELL_SHARE = 0.25;

/** Upgrade and salvage materials. Mythic Cores only come from bosses (Phase 5). */
export const MATERIALS = ["scrap", "mythicCore"] as const;
export type Material = (typeof MATERIALS)[number];

/** Scrap from salvaging an item, by its current rarity. Coins and scrap spent upgrading it aren't refunded. */
export const SALVAGE: Record<Rarity, number> = { common: 5, uncommon: 15, rare: 35, epic: 80, legendary: 150, mythic: 250 };

export interface UpgradeCost {
  coins: number;
  scrap: number;
  mythicCore?: number;
}

/**
 * Cost of the next upgrade by current rarity: +0 → +1, +1 → +2, then +2 → the next rarity at +0.
 * Null: that rarity can't be promoted. Legendary → Mythic is for named gear only.
 */
export const UPGRADE_COSTS: Record<Rarity, [UpgradeCost, UpgradeCost, UpgradeCost | null]> = {
  common: [{ coins: 40, scrap: 2 }, { coins: 60, scrap: 3 }, { coins: 150, scrap: 5 }],
  uncommon: [{ coins: 100, scrap: 4 }, { coins: 150, scrap: 6 }, { coins: 400, scrap: 10 }],
  rare: [{ coins: 250, scrap: 8 }, { coins: 350, scrap: 12 }, { coins: 900, scrap: 20 }],
  epic: [{ coins: 600, scrap: 15 }, { coins: 800, scrap: 20 }, { coins: 2000, scrap: 40 }],
  legendary: [{ coins: 1200, scrap: 30 }, { coins: 1600, scrap: 40 }, { coins: 4000, scrap: 80, mythicCore: 1 }],
  mythic: [{ coins: 2500, scrap: 50 }, { coins: 3500, scrap: 70 }, null],
};

// ---- Titles (section 5.1) ----

export const TITLES = {
  defaultSlots: 1,
  maxSlots: 3,
  /** Coins for the second and third title slot. */
  slotCosts: [500, 1500],
};

/** What each achievement asks for, and its title's bonus (a share of battle power, in the bonus bucket). */
export const ACHIEVEMENTS = {
  /** This many counted workouts in all. */
  firstSteps: { workouts: 6, bonus: 0.02 },
  /** This many counted workouts in each of `weeks` weeks in a row. */
  regular: { weeks: 4, workoutsPerWeek: 3, bonus: 0.03 },
  /** No skipped scheduled workout for `days` days, with at least `minSlots` scheduled in that time. */
  unbroken: { days: 28, minSlots: 8, bonus: 0.05 },
  /** Beat your last session on exercises of this many different stats in one workout. */
  recordBreaker: { stats: 3, bonus: 0.03 },
  /** Claim every quest of one week. */
  questmaster: { bonus: 0.03 },
  /** Every stat at this or more at the same time. */
  wellRounded: { minStat: 50, bonus: 0.04 },
  /** Trained in `weeks` of the last `outOf` weeks. `outOf` must fit in WEEKS_KEPT. */
  ironHabit: { weeks: 12, outOf: 16, bonus: 0.04 },
  /** This many counted workouts in all. */
  centurion: { workouts: 100, bonus: 0.03 },
};

/** Weeks start Sunday 00:00 in the user's time zone (section 3.5). */
export const WEEK_START_DAY = 0;

export const DEFAULT_TIME_ZONE = "UTC";

// ---- Combat (sections 4 and 10, Phase 5) ----
// First draft of every combat number. After the fight engine is built, scripts/combat-table.ts prints
// win chances by class, boss type and power ratio so these can be tuned.

export const CLASS_IDS = ["vanguard", "striker", "cleric"] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export interface ClassDef {
  name: string;
  /** Added to the bonus pool (titles + class, capped at BONUS_BUCKET_CAP). Small on purpose: titles share it. */
  bucketPct: number;
  /** How this class turns stats into combat attributes: multiplies HP, ATK and DEF. */
  weights: { hp: number; atk: number; def: number };
  /** Seconds between basic attacks. */
  attackEverySec: number;
  skill: { name: string; cooldownSec: number; firstAtSec: number };
  ultimate: { name: string };
}

/** Picking a class is free once; after that a switch costs coins, at most once per `everyDays` since the last switch. */
export const CLASS_SWITCH = { cost: 300, everyDays: 7 };

export const CLASSES: Record<ClassId, ClassDef> = {
  vanguard: {
    name: "Vanguard",
    bucketPct: 0.03,
    weights: { hp: 1.2, atk: 0.7, def: 1.2 },
    attackEverySec: 0.9,
    skill: { name: "Guard", cooldownSec: 6, firstAtSec: 2 },
    ultimate: { name: "Bastion" },
  },
  striker: {
    name: "Striker",
    bucketPct: 0.03,
    weights: { hp: 0.9, atk: 1.4, def: 0.8 },
    attackEverySec: 0.9,
    skill: { name: "Power Strike", cooldownSec: 6, firstAtSec: 3 },
    ultimate: { name: "Execution" },
  },
  cleric: {
    name: "Cleric",
    bucketPct: 0.03,
    weights: { hp: 1.1, atk: 0.8, def: 1 },
    attackEverySec: 1,
    skill: { name: "Mend", cooldownSec: 6, firstAtSec: 3 },
    ultimate: { name: "Radiance" },
  },
};

/** What each class's skill and ultimate do. */
export const SKILLS = {
  /** Vanguard: damage taken from hits is halved for a while. Held for a telegraphed big hit; with none coming, used once hurt below useBelowPct. */
  guard: { damageTakenFactor: 0.5, durationSec: 3, useBelowPct: 0.6 },
  /** Striker: one hit at this times attack. */
  powerStrike: { multiplier: 2.2 },
  /**
   * Cleric only: heals maxHP × min(maxPct, basePct + perCorePct × Core / your average stat), used once
   * hurt below useBelowPct. A Core stronger than your other stats heals more, at any power level.
   */
  mend: { basePct: 0.06, perCorePct: 0.07, maxPct: 0.25, useBelowPct: 0.7 },
  /** Vanguard ultimate: slams for strikeMultiplier × attack and raises a shield of shieldPct of max HP for a while. */
  bastion: { strikeMultiplier: 3, shieldPct: 0.12, durationSec: 8 },
  /** Striker ultimate: one hit at this times attack. */
  execution: { multiplier: 4 },
  /** Cleric ultimate: heals this share of max HP and stops bleeding for a while. */
  radiance: { healPct: 0.2, bleedFreeSec: 8 },
};

/** The Mythics' unique effects (section 10). */
export const MYTHIC_EFFECTS = {
  "unbroken-crown": { label: "Last Stand: once a fight, survive a killing blow at 1 HP" },
  "unbroken-heart": { label: "Reflects 15% of damage taken" },
  "unbroken-hands": { label: "Every 4th attack is a critical hit" },
  "unbroken-pillars": { label: "Regenerates 3% of max HP every 2 s while under half HP" },
  "unbroken-path": { label: "The enemy enrages 5 s later" },
  "executioners-ring": { label: "Hits on an enemy under 30% HP are always crits" },
  "bloodletter-gauntlets": { label: "Crits heal you for 30% of their damage" },
  "bulwark-plate": { label: "While Guard is up, reflect 50% of each hit" },
  "oathkeeper-belt": { label: "Bastion's shield is 25% bigger" },
  "saints-locket": { label: "Mend also stops bleeding for 4 s" },
  "dawn-censer": { label: "Healing past full HP becomes a shield, up to 15% of max HP" },
} as const;
export type MythicEffect = keyof typeof MYTHIC_EFFECTS;

export const COMBAT = {
  /** The fight is simulated in steps of this many milliseconds. */
  tickMs: 100,
  /** At this many seconds the enemy enrages and the fight is lost. */
  enrageSec: 45,
  /** HP = HP points × this. ATK and DEF are their points as they are. */
  hpPerPoint: 8,
  /**
   * A hit lands for attack × K / (K + defense), where K = defenseShare × the defender's own battle
   * power: defense counts relative to how strong its owner is, so a fight plays the same at any power
   * level and every class weight stays linear.
   */
  defenseShare: 0.29,
  /** Every hit varies by up to this share either way, so fights near even can go both ways. */
  damageSpread: 0.15,
  /**
   * Each side's form on the day: one roll per fight multiplies its damage by up to this share either
   * way, so fights near even power can go both ways instead of the stronger side always winning.
   */
  formSpread: 0.12,
  baseCrit: 0.08,
  critMultiplier: 1.6,
  /** The ultimate fires when energy reaches `full`. Taking hits charges it faster, so tanks get theirs too. */
  energy: { perHitLanded: 5, perHitTaken: 8, full: 100 },
  /** How each stat's points split into HP / ATK / DEF, before class weights. Each row adds up to 1. */
  statAttributes: {
    chest: { hp: 0, atk: 0.6, def: 0.4 },
    back: { hp: 0.5, atk: 0.2, def: 0.3 },
    shoulders: { hp: 0.2, atk: 0.5, def: 0.3 },
    arms: { hp: 0.2, atk: 0.8, def: 0 },
    legs: { hp: 0.6, atk: 0.2, def: 0.2 },
    core: { hp: 0.5, atk: 0, def: 0.5 },
  } as Record<Stat, { hp: number; atk: number; def: number }>,
  /**
   * Boss minimums are shares of the stat a typically geared hero at the boss's power has
   * (`typicalStats`, from PACING). Being under one is allowed only with this much more power than the boss.
   */
  minimumMargin: 0.2,
  /** A necklace's healing works at this strength for anyone who isn't a Cleric. */
  necklaceNonClericFactor: 0.25,
  /** A necklace heals its healing share of max HP this often. */
  necklaceEverySec: 5,
  /**
   * Duplicate accessory effects (and set effects) add up, to these caps. Values and caps are half
   * the first draft's: fights are steep around even power, so a full endgame loadout's effects are
   * worth only about 7-10% power (npm run combat-table, the "+" rows).
   */
  effectCaps: {
    crit: 0.125,
    healing: 0.1,
    damageReduction: 0.1,
    haste: 0.125,
    ultCharge: 0.2,
    lifesteal: 0.06,
    critDamage: 0.3,
    finisher: 0.25,
    guardDuration: 0.375,
    bastionShield: 0.3,
    thorns: 0.075,
    healPower: 0.3,
    bleedResist: 0.225,
    salvageYield: 0.5,
    rerollDiscount: 0.5,
  } as Record<AccessoryEffect, number>,
  /** Finisher and Executioner's Ring work on an enemy under this share of its HP. */
  finisherBelowPct: 0.3,
  mythic: {
    lastStandHp: 1,
    heartReflect: 0.15,
    handsEvery: 4,
    pillarsBelowPct: 0.5,
    pillarsPct: 0.03,
    pillarsEverySec: 2,
    pathEnrageSec: 5,
    executionerBelowPct: 0.3,
    bloodletterHealPct: 0.3,
    bulwarkReflect: 0.5,
    oathkeeperShieldFactor: 1.25,
    saintsBleedFreeSec: 4,
    censerShieldMaxPct: 0.15,
  },
  /**
   * An enemy's numbers from its recommended battle power P, before the boss's own multipliers:
   * HP = P × hpPerPower, ATK = P × atkPerPower, DEF = P × defPerPower.
   */
  foe: { hpPerPower: 6.3, atkPerPower: 0.48, defPerPower: 0.33, attackEverySec: 1.5 },
};

/** Weekly boss (section 10): one fight a day, tier locked at week start. */
export const WEEKLY_BOSS = {
  /** Level needed for tiers 1 to 5. */
  tierLevels: [1, 8, 15, 25, 35],
  /** Recommended battle power of tiers 1 to 5. */
  tierPower: [150, 250, 350, 475, 625],
  /** You get the highest tier your level allows whose recommended power you reach this share of. */
  tierPowerShare: 0.9,
  /** The daily fight resets at this hour in the user's time zone. */
  resetHour: 4,
  /** The week's first win pays these, by tier; later wins pay refightShare of them. */
  coins: [50, 75, 100, 125, 150],
  scrap: [10, 20, 30, 45, 60],
  refightShare: 0.5,
};

/** Drops from boss wins (weekly boss and Boss Tower first clears). */
export const BOSS_DROPS = {
  /** By weekly tier 1 to 5: the chance of a gear drop, and its rarity when it drops. */
  tiers: [
    { chance: 0.01, weights: { rare: 100 } },
    { chance: 0.015, weights: { rare: 80, epic: 20 } },
    { chance: 0.02, weights: { rare: 50, epic: 45, legendary: 5 } },
    { chance: 0.025, weights: { epic: 60, legendary: 38, mythic: 2 } },
    { chance: 0.03, weights: { epic: 40, legendary: 55, mythic: 5 } },
  ] as { chance: number; weights: Partial<Record<Rarity, number>> }[],
  /** A Mythic Core drops with this chance on a weekly win at tier fromTier or higher. */
  mythicCore: { fromTier: 4, chance: 0.02 },
  /**
   * Guarantees, counted in wins that could have dropped that rarity: a Legendary after this many
   * without one, a Mythic (with a Mythic Core) after this many without one.
   */
  pity: { legendary: 42, mythic: 210 },
};

/** The endless tower: generic floors, only the next one can be fought. */
export const ENDLESS_TOWER = {
  minLevel: 5,
  basePower: 120,
  growth: 1.05,
  lossCooldownHours: 4,
  autoClimbMax: 5,
  /** Coins for a floor: base + one per two floors, at most max; every 10th floor pays tenthFloorMultiplier times. */
  coins: { base: 5, perTwoFloors: 1, max: 30, tenthFloorMultiplier: 3 },
  scrap: { base: 2, perTenFloors: 1 },
  gear: { chance: 0.08, weights: { common: 50, uncommon: 35, rare: 15 } as Partial<Record<Rarity, number>> },
};

/** The Boss Tower: a named boss per floor; first clears pay well, reclears pay a little gold. */
export const BOSS_TOWER = {
  minLevel: 15,
  floors: 30,
  basePower: 300,
  growth: 1.05,
  cooldownHours: 4,
  /** Floors per drop tier: floors 1-6 drop like weekly tier 1, 7-12 like tier 2, and so on. */
  floorsPerTier: 6,
  coins: { base: 60, perFloor: 6 },
  scrap: { base: 10, perFloor: 2 },
  /** A first clear's gear chance; the rarity split is the weekly tier's. */
  gearChance: 0.15,
  /** Every coreEvery-th floor's first clear has this chance of a Mythic Core. */
  coreEvery: 10,
  coreChance: 0.5,
  /** A reclear pays this share of the first clear's coins, and nothing else. */
  reclearCoinShare: 0.1,
};

/** The Campaign: chapters of fixed stages, only the next one can be fought, no cooldown. */
export const CAMPAIGN = {
  chapters: 5,
  stagesPerChapter: 12,
  basePower: 100,
  growth: 1.025,
  coins: { base: 20, perStage: 1 },
  scrap: { base: 3, perSixStages: 1 },
  /** Never Legendary or Mythic; Epic very rare, because there are many stages. */
  gear: { chance: 0.1, weights: { common: 60, uncommon: 30, rare: 9.5, epic: 0.5 } as Partial<Record<Rarity, number>> },
};
