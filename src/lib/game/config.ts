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

/** Training weeks kept per sub-muscle in game/muscles. Must be at least FREQUENCY_WEEKS. */
export const WEEKS_KEPT = 8;

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
export const EPLEY_MAX_REPS = 15;

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
  /** Per point of power above the highest power reached before. */
  perPowerPoint: 10,
  /** Flat, uncapped levels. */
  perLevel: 500,
};

/** Weeks start Sunday 00:00 in the user's time zone (section 3.5). */
export const WEEK_START_DAY = 0;

export const DEFAULT_TIME_ZONE = "UTC";
