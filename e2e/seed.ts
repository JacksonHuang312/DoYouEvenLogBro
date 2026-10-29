import { BASE_ITEMS, baseItem } from "../src/lib/game/catalog";
import { newGameState, type GameState } from "../src/lib/game/claim";
import { STAT_MUSCLES, STAT_POINTS, STATS } from "../src/lib/game/config";
import type { MusclesFacts } from "../src/lib/game/facts";
import { newItem, type Item } from "../src/lib/game/items";
import { emptyShop } from "../src/lib/game/shop";
import { weekId } from "../src/lib/game/time";
import { adminAuth, adminDb } from "../src/lib/server/admin";

/*
 * Seeds the emulators with one test user ("hero") and a known gear collection. Test data only:
 * it refuses to run unless the Firestore emulator is configured, so it can never touch the real
 * project.
 */

export const HERO = { uid: "e2e-hero", email: "hero@test.dev", password: "password123", username: "hero" } as const;

/** Named inventory ids, so tests can say which copy they mean. */
export const ITEM_IDS = {
  loopA: "e2e-silver-loop-a",
  loopB: "e2e-silver-loop-b",
  seal: "e2e-gold-seal",
  band: "e2e-copper-band",
  sunforged: "e2e-sunforged-ring",
  helm: "e2e-steelguard-helmet",
  pot: "e2e-scrapper-pot",
} as const;

const GEAR: Record<keyof typeof ITEM_IDS, string> = {
  loopA: "silver-loop", // Rare ring. Two identical copies, to test stacking.
  loopB: "silver-loop",
  seal: "gold-seal", // Epic ring.
  band: "copper-band", // Common ring.
  sunforged: "sunforged-ring", // Legendary ring: named, so salvage-only.
  helm: "steelguard-helmet", // Rare helmet from a set.
  pot: "scrapper-helmet", // Common helmet (ATK 20 / DEF 80): the longest subtitle. Only when asked for.
};

export interface SeedOptions {
  coins?: number;
  scrap?: number;
  level?: number;
  /** Items to give, by ITEM_IDS key. Default: all of them except `pot`. */
  gear?: (keyof typeof ITEM_IDS)[];
  /** Also write this week's (empty) shop doc, as if the user had already used the shop. Without it the shop doc does not exist yet. */
  shopDoc?: boolean;
  /** Also write a saved routine (ROUTINE_ID: "Push day", one Bench Press exercise), with a rep range if given. */
  routine?: boolean | { repMin: number; repMax: number; stepKg?: number };
  /** The unit the profile counts in. Default "lb". */
  unit?: "kg" | "lb";
  /** Also write one past workout of Bench Press with these reps at this weight, so "last time" has something to show. */
  lastBench?: { weightKg: number; reps: number[] };
}

export const ROUTINE_ID = "e2e-routine";
export const BENCH_ID = "Barbell_Bench_Press_-_Medium_Grip";

function assertEmulator() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error("e2e seeding only runs against the Firebase emulators (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST are not set).");
  }
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  if (!project.startsWith("demo-")) throw new Error(`Refusing to seed project "${project}": e2e only uses demo-* projects.`);
}

/** About 30 in every stat (300 working sets each, split like a typical stat), trained yesterday. */
function muscles(now: number): MusclesFacts {
  return Object.fromEntries(
    STATS.flatMap((stat) =>
      Object.entries(STAT_MUSCLES[stat]).map(([m, share]) => [
        m,
        { sets: Math.round(30 * STAT_POINTS.perStat * share), progressed: 0, lastTrained: now - 86_400_000, weeks: [] as string[] },
      ]),
    ),
  ) as MusclesFacts;
}

/** Counted workouts already claimed: enough for First Steps. */
const CLAIMS = 6;

/** Wipes and recreates the test user. Returns its uid. Call before every test. */
export async function resetHero(options: SeedOptions = {}): Promise<string> {
  assertEmulator();
  const { coins = 5000, scrap = 300, level = 30, gear = (Object.keys(ITEM_IDS) as (keyof typeof ITEM_IDS)[]).filter((k) => k !== "pot"), shopDoc = false, routine = false, unit = "lb", lastBench } = options;
  const db = adminDb();
  const now = Date.now();

  try {
    await adminAuth().getUser(HERO.uid);
  } catch {
    await adminAuth().createUser({ uid: HERO.uid, email: HERO.email, password: HERO.password });
  }
  await db.recursiveDelete(db.collection("users").doc(HERO.uid));

  const user = db.collection("users").doc(HERO.uid);
  await user.set({
    username: HERO.username,
    usernameChangedAt: new Date(now - 30 * 86_400_000),
    displayName: HERO.username,
    photoURL: null,
    unit,
    isPrivate: false,
    createdAt: now - 30 * 86_400_000,
  });
  await db.collection("usernames").doc(HERO.username).set({ uid: HERO.uid });

  const state: GameState = {
    ...newGameState(now - 30 * 86_400_000, "America/Toronto"),
    coins,
    // 500 XP per level (GAME_DESIGN.md 3): high enough to equip anything below Mythic.
    xp: (level - 1) * 500,
    level,
    materials: { scrap },
    updatedAt: now,
  };
  await user.collection("game").doc("state").set(state);
  await user.collection("game").doc("muscles").set({ muscles: muscles(now), updatedAt: now });
  // Only claimedAt is read from these (title progress); the workouts behind them aren't seeded.
  for (let i = 0; i < CLAIMS; i++) {
    await user.collection("claims").doc(`e2e-claim-${i}`).set({ workoutId: `e2e-claim-${i}`, claimedAt: now - (i + 2) * 86_400_000 });
  }

  for (const key of gear) {
    const base = baseItem(GEAR[key]);
    if (!base) throw new Error(`Unknown base item ${GEAR[key]}`);
    const made = newItem(base, "admin", now);
    if (!made.ok) throw new Error(made.error);
    await user.collection("inventory").doc(ITEM_IDS[key]).set(made.value satisfies Item);
  }
  if (shopDoc) {
    const week = weekId(now, "America/Toronto");
    await user.collection("shop").doc(week).set(emptyShop(week, "America/Toronto", now));
  }
  if (routine) {
    await user.collection("routines").doc(ROUTINE_ID).set({
      name: "Push day",
      exercises: [
        {
          exerciseId: BENCH_ID,
          name: "Barbell Bench Press - Medium Grip",
          sets: 3,
          restSec: 90,
          ...(typeof routine === "object" ? routine : {}),
        },
      ],
      updatedAt: now,
    });
  }
  if (lastBench) {
    const sets = lastBench.reps.map((reps) => ({ type: "normal", weightKg: lastBench.weightKg, reps }));
    await user.collection("workouts").doc("e2e-last-bench").set({
      name: "Push day",
      startedAt: now - 7 * 86_400_000,
      endedAt: now - 7 * 86_400_000 + 3_600_000,
      exercises: [{ exerciseId: BENCH_ID, name: "Barbell Bench Press - Medium Grip", sets }],
      exerciseIds: [BENCH_ID],
      volumeKg: lastBench.reps.reduce((n, r) => n + r * lastBench.weightKg, 0),
      setCount: sets.length,
    });
  }
  return HERO.uid;
}

/** Every catalog base id, for tests that want to check a lot of items at once. */
export const ALL_BASE_IDS = BASE_ITEMS.map((b) => b.id);

// `npm run e2e:seed`: seed the emulators by hand to click around the app (sign in as hero@test.dev).
if (process.argv[1]?.endsWith("seed.ts")) {
  Object.assign(process.env, {
    NEXT_PUBLIC_FIREBASE_EMULATOR: "1",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-dyelb",
  });
  resetHero().then(
    (uid) => console.log(`Seeded ${HERO.email} / ${HERO.password} (uid ${uid})`),
    (err) => {
      console.error(err);
      process.exitCode = 1;
    },
  );
}
