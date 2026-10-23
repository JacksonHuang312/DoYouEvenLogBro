/**
 * Every tunable number in the game (GAME_DESIGN.md). Logic in src/lib/game/ reads from here and
 * never hard-codes values, so rebalancing is a config change, not a data migration.
 */

export const STATS = ["chest", "back", "shoulders", "arms", "legs", "core"] as const;
export type Stat = (typeof STATS)[number];

/**
 * The 17 sub-muscles (the `muscle` values in src/data/exercises.json), grouped by stat, with each
 * one's weight in its stat's weighted average. Each stat's weights sum to 1. Section 2.1.
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

/** Power = Σ(stat × multiplier). Section 2.5. */
export const POWER_MULTIPLIERS: Record<Stat, number> = {
  chest: 1,
  back: 1,
  shoulders: 1,
  arms: 1,
  legs: 1,
  core: 0.5,
};

// ---- Sub-muscle score (section 2.2) ----

/** Share of a sub-muscle's score from strength; the rest is training frequency. */
export const STRENGTH_SHARE = 0.8;

/** Frequency: how many of the last N weeks (this one included) the sub-muscle was trained. */
export const FREQUENCY_WEEKS = 4;

/**
 * Training weeks kept per sub-muscle in game/muscles. Must be at least FREQUENCY_WEEKS plus the
 * longest freeze (an injury flag, INJURY.expiryWeeks), since frozen weeks are skipped when counting.
 */
export const WEEKS_KEPT = 16;

/**
 * Estimated 1RM ÷ bodyweight that scores 100 for an adult male (placeholder strength standards;
 * see "Open questions"). Scaled by STANDARD_SEX_FACTOR and the age factor below.
 */
export const STRENGTH_STANDARDS: Record<SubMuscle, number> = {
  chest: 1.75,
  lats: 1.5,
  "middle back": 1.6,
  "lower back": 2.5,
  shoulders: 1.1,
  traps: 2.5,
  neck: 0.5,
  triceps: 1.0,
  biceps: 0.9,
  forearms: 0.8,
  quadriceps: 2.5,
  hamstrings: 2.0,
  calves: 2.5,
  glutes: 2.5,
  adductors: 1.5,
  abductors: 1.5,
  abdominals: 1.5,
};

export type Sex = "male" | "female";

/** Multiplies the standards above. Unknown sex uses the average. */
export const STANDARD_SEX_FACTOR: Record<Sex | "unknown", number> = {
  male: 1,
  female: 0.65,
  unknown: 0.825,
};

/** Age adjustment of the standards: `youth` under `youthAge`, 1 up to `peakAgeEnd`, then down each year to `min`. */
export const AGE_FACTOR = {
  youthAge: 20,
  youth: 0.9,
  peakAgeEnd: 39,
  perYearAfterPeak: 0.01,
  min: 0.6,
};

/** Used until the user enters their bodyweight (onboarding is Phase 2). */
export const DEFAULT_BODYWEIGHT_KG = 75;

/**
 * Bodyweight exercises: the load is bodyweight × a factor (plus any added weight logged on a
 * "body only" exercise). DEFAULT applies unless the exercise has its own factor.
 */
export const BODYWEIGHT_FACTOR = {
  default: 0.65,
  byExercise: {
    Pullups: 1,
    "Chin-Up": 1,
    "V-Bar_Pullup": 1,
    "Dips_-_Chest_Version": 0.95,
    "Dips_-_Triceps_Version": 0.95,
    "Handstand_Push-Ups": 0.9,
    Bench_Dips: 0.6,
  } as Record<string, number>,
};

/** Epley gets wild at high reps, so the estimate uses at most this many. */
export const EPLEY_MAX_REPS = 12;

/** Sets beyond these are treated as typos and ignored by the game. */
export const SANITY = { maxLoadKg: 600, maxReps: 100 };

// ---- 1RM bonus (section 2.3) ----

/** The bonus from beating your calculated 1RM is at most this fraction of the stat. */
export const ONE_RM_BONUS_CAP = 0.05;

// ---- Decay (section 2.4) ----

export const DECAY = {
  /** Days without training before the strength part starts to decay. */
  graceDays: 7,
  /** Fraction lost per day after the grace period, compounding. */
  perDay: 0.01,
  /** Decay never takes the strength part below this fraction of its undecayed value. */
  floor: 0.5,
};

// ---- Calibration and starting stats (section 2.6) ----

export const CALIBRATION = { days: 14, workouts: 6 };

/** Sub-muscle score shown during calibration ("population average"; scores are already normalized by sex/age). */
export const POPULATION_AVERAGE_SCORE = 30;

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
  /** Flat, uncapped levels. */
  perLevel: 500,
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
  /** Ended pauses are kept this long (decay needs them to stay frozen). */
  historyDays: 365,
};

export const INJURY = {
  maxStats: 2,
  expiryWeeks: 8,
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
  crit: { label: "Crit chance", value: 0.05 },
  healing: { label: "Healing", value: 0.06 },
  damageReduction: { label: "Damage reduction", value: 0.04 },
  bossCooldown: { label: "Boss cooldown reduction", value: 0.1 },
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
  /** Finish calibration. */
  calibrated: { bonus: 0.02 },
  /** This many counted workouts in each of `weeks` weeks in a row. */
  regular: { weeks: 4, workoutsPerWeek: 3, bonus: 0.03 },
  /** No skipped scheduled workout for `days` days, with at least `minSlots` scheduled in that time. */
  unbroken: { days: 28, minSlots: 8, bonus: 0.05 },
  /** A 1RM bonus (section 2.3) on this many stats at once. */
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
