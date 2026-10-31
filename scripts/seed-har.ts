// Seeds the local emulators with a playable test account, so the RPG screens have something to show
// without any logged workouts. Emulator only: it refuses to run unless the Firestore and Auth
// emulators are set and the project is a demo-* one, so it can never touch the real project.
//
//   npm run emulators                     # in one terminal
//   npm run seed:har                      # level 40, about 40 in every stat, no class yet, a gear kit
//   npm run seed:har -- --level 60 --stat 60 --class striker
//   npm run dev:emu          # http://localhost:3200, wired to the emulators
//
// The gear kit (GAME_DESIGN.md 13.18) is built around the level: a weapon of each type, a full set and
// part of another from the level's band, loose armor below the level (to reforge), accessories in every
// rarity, a Legendary +2 and a Mythic Core (to try the Mythic upgrade), a unique Mythic, and one item
// above the level (locked).
//
// Then sign in through the emulator hook in the browser console:
//   window.__emulatorSignIn("har@test.dev", "password123")
// Emulator data is lost when the emulators stop; run the seed again after a restart.
import { parseArgs } from "node:util";
import { baseItem, basesFor, bandOf, SETS } from "../src/lib/game/catalog";
import { ARMOR_SLOTS, CLASS_IDS, ITEM_LEVEL, type ClassId, type Rarity } from "../src/lib/game/config";

// The usual emulator ports unless the environment already points elsewhere; only this machine's.
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
for (const host of [
  process.env.FIRESTORE_EMULATOR_HOST,
  process.env.FIREBASE_AUTH_EMULATOR_HOST,
]) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host))
    throw new Error(`Refusing to seed ${host}: only local emulators.`);
}
Object.assign(process.env, {
  NEXT_PUBLIC_FIREBASE_EMULATOR: "1",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-dyelb",
});

const { values } = parseArgs({
  options: {
    level: { type: "string", default: "40" },
    stat: { type: "string", default: "40" },
    class: { type: "string" },
  },
});
const level = Number(values.level);
const statLevel = Number(values.stat);
if (!Number.isInteger(level) || level < 1 || level > 100)
  throw new Error("--level must be 1 to 100");
if (!(statLevel >= 0)) throw new Error("--stat must be a number");
if (values.class && !CLASS_IDS.includes(values.class as ClassId))
  throw new Error(`--class must be one of ${CLASS_IDS.join(", ")}`);

const HAR = {
  uid: "emulator-har",
  email: "har@test.dev",
  password: "password123",
  username: "har",
} as const;

type KitItem = { baseId: string; rarity: Rarity; itemLevel: number; plus?: number };

/** The playtest gear for a hero at `level`, leaning toward `classId`'s set (Vanguard's without a class). */
function gearKit(level: number, classId: ClassId | undefined): KitItem[] {
  const at = (offset: number) => Math.min(ITEM_LEVEL.max, Math.max(ITEM_LEVEL.min, level + offset));
  const band = bandOf(level);
  const bandSets = SETS.filter((s) => s.band === band);
  const own = bandSets.find((s) => s.classId === (classId ?? "vanguard"))!;
  const other = bandSets.find((s) => s !== own)!;
  const weapon = (type: string) => basesFor("weapon", level).find((b) => b.weapon === type)!.id;
  return [
    // A weapon of each type, so the class bonus and the compare arrows show.
    { baseId: weapon("sword"), rarity: "rare", itemLevel: at(0) },
    { baseId: weapon("staff"), rarity: "epic", itemLevel: at(-3) },
    { baseId: weapon("shield"), rarity: "uncommon", itemLevel: at(0) },
    // A full set (the 5-piece effect) at Rare, and two Epic pieces of another set.
    ...ARMOR_SLOTS.map((slot): KitItem => ({ baseId: `${own.id}-${slot}`, rarity: "rare", itemLevel: at(-2) })),
    { baseId: `${other.id}-helmet`, rarity: "epic", itemLevel: at(0) },
    { baseId: `${other.id}-boots`, rarity: "epic", itemLevel: at(-1) },
    // Loose armor well below the level: worth reforging. Two identical copies stack as ×2.
    { baseId: "ironbound-chestplate", rarity: "uncommon", itemLevel: at(-15) },
    { baseId: "drifter-gloves", rarity: "common", itemLevel: at(-10) },
    { baseId: "drifter-gloves", rarity: "common", itemLevel: at(-10) },
    // Accessories in every rarity, Common to Legendary.
    { baseId: "copper-band", rarity: "common", itemLevel: at(0) },
    { baseId: "silver-loop", rarity: "rare", itemLevel: at(-4) },
    { baseId: "amber-torque", rarity: "epic", itemLevel: at(-2) },
    { baseId: "leather-belt", rarity: "uncommon", itemLevel: at(0) },
    { baseId: "storm-bead", rarity: "rare", itemLevel: at(0) },
    { baseId: "chrono-charm", rarity: "legendary", itemLevel: at(-5) },
    // A Legendary +2 to turn Mythic with the seeded Mythic Core, and a unique Mythic.
    { baseId: `${own.id}-gloves`, rarity: "legendary", itemLevel: at(-6), plus: 2 },
    { baseId: "executioners-ring", rarity: "mythic", itemLevel: at(-3) },
    // Above the level: locked until you get there.
    { baseId: "hunter-leggings", rarity: "epic", itemLevel: at(5) },
  ];
}

async function main() {
  // Imported after the environment is set, because the admin SDK reads it on load.
  const { resetHero } = await import("../e2e/seed");
  const { adminDb } = await import("../src/lib/server/admin");
  const { newItem } = await import("../src/lib/game/items");
  const classId = values.class as ClassId | undefined;
  await resetHero({ who: HAR, level, statLevel, classId, coins: 5000, scrap: 1500, shopDoc: true, gear: [] });

  const user = adminDb().collection("users").doc(HAR.uid);
  const kit = gearKit(level, classId);
  const batch = adminDb().batch();
  kit.forEach((k, i) => {
    const made = newItem(baseItem(k.baseId)!, "admin", Date.now(), k);
    if (!made.ok) throw new Error(`${k.baseId}: ${made.error}`);
    batch.set(user.collection("inventory").doc(`har-${String(i).padStart(2, "0")}-${k.baseId}`), made.value);
  });
  batch.update(user.collection("game").doc("state"), { "materials.mythicCore": 1 });
  await batch.commit();

  console.log(
    `Seeded ${HAR.email} / ${HAR.password} (username ${HAR.username}): level ${level}, about ${statLevel} in every stat${classId ? `, ${classId}` : ", no class yet"}, ${kit.length} items, 1,500 scrap and a Mythic Core.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
