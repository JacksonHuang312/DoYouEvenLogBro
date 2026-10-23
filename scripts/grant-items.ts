// Grants gear, materials and coins to one account, so every rarity can be seen before boss drops exist
// (Phase 5). A developer tool: there is deliberately no API route for this. Granted items are
// marked source "admin".
//
//   npm run grant-items -- --uid <uid> --all --dry-run          # one of every catalog item, at its own rarity
//   npm run grant-items -- --uid <uid> --base warden-chestplate --rarity legendary --plus 2
//   npm run grant-items -- --uid <uid> --base titans-vow-helmet --base unbroken-boots
//   npm run grant-items -- --uid <uid> --materials scrap=300,mythicCore=1
//   npm run grant-items -- --uid <uid> --coins 5000
//
// Credentials: the FIREBASE_ADMIN_* vars from .env.local (or the environment). Against anything
// but the emulators it also needs --confirm <projectId>, naming the project it will write to.
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { BASE_ITEMS, baseItem } from "../src/lib/game/catalog";
import { newGameState, type GameState } from "../src/lib/game/claim";
import { DEFAULT_TIME_ZONE, MATERIALS, RARITIES, type Material, type Rarity } from "../src/lib/game/config";
import { newItem, piecePower, type Item } from "../src/lib/game/items";
import { adminDb } from "../src/lib/server/admin";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: credentials come from the environment.
}

const { values: args } = parseArgs({
  options: {
    uid: { type: "string" },
    all: { type: "boolean", default: false },
    base: { type: "string", multiple: true, default: [] },
    rarity: { type: "string" },
    plus: { type: "string", default: "0" },
    materials: { type: "string" },
    coins: { type: "string" },
    confirm: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const uid = args.uid ?? fail("--uid is required: the account to grant to.");
const dryRun = args["dry-run"];

const emulator = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1" || !!process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "(unknown)";
if (!emulator && !dryRun && args.confirm !== projectId) {
  fail(`This writes to the real project "${projectId}". Re-run with --confirm ${projectId} if that's intended.`);
}

if (args.rarity && !RARITIES.includes(args.rarity as Rarity)) fail(`--rarity must be one of ${RARITIES.join(", ")}`);
const plus = Number(args.plus);

function parseMaterials(text: string | undefined): Partial<Record<Material, number>> {
  if (!text) return {};
  return Object.fromEntries(
    text.split(",").map((pair) => {
      const [name, value] = pair.split("=");
      const n = Number(value);
      if (!MATERIALS.includes(name as Material) || !Number.isInteger(n) || n <= 0) {
        fail(`Bad --materials "${pair}": use name=count with one of ${MATERIALS.join(", ")}`);
      }
      return [name, n];
    }),
  );
}
const materials = parseMaterials(args.materials);

const coins = args.coins === undefined ? 0 : Number(args.coins);
if (args.coins !== undefined && (!Number.isSafeInteger(coins) || coins <= 0)) fail("--coins must be a positive whole number.");

const now = Date.now();
const baseIds = args.all ? BASE_ITEMS.map((b) => b.id) : args.base;
const items: { id: string; item: Item }[] = baseIds.map((id) => {
  const base = baseItem(id) ?? fail(`Unknown base item "${id}". Known: ${BASE_ITEMS.map((b) => b.id).join(", ")}`);
  // --all keeps each item at its own rarity; --rarity applies to the --base items.
  const made = newItem(base, "admin", now, { rarity: args.all ? base.rarity : ((args.rarity as Rarity) ?? base.rarity), plus });
  if (!made.ok) fail(`${id}: ${made.error}`);
  return { id: `admin-${randomUUID()}`, item: made.value };
});
if (items.length === 0 && Object.keys(materials).length === 0 && coins === 0) fail("Nothing to grant: pass --all, --base, --materials or --coins.");

async function main() {
  const db = adminDb();
  const user = db.collection("users").doc(uid);
  if (!(await user.get()).exists) fail(`No user ${uid} in ${emulator ? "the emulator" : projectId}.`);

  console.log(`${dryRun ? "DRY RUN: " : ""}granting to ${uid} in ${emulator ? "the emulator" : projectId}`);
  for (const { id, item } of items) {
    console.log(`  ${id}  ${item.baseId}  ${item.rarity} +${item.plus}${item.named ? " (named)" : ""}  power ${piecePower(item).toFixed(1)}`);
  }
  for (const [name, n] of Object.entries(materials)) console.log(`  +${n} ${name}`);
  if (coins > 0) console.log(`  +${coins} coins`);
  if (dryRun) return console.log("DRY RUN, nothing written.");

  const stateRef = user.collection("game").doc("state");
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(stateRef);
    if (coins > 0 || Object.keys(materials).length > 0) {
      const state = snap.exists ? (snap.data() as GameState) : newGameState(now, DEFAULT_TIME_ZONE);
      const next = { ...(state.materials ?? {}) };
      for (const [name, n] of Object.entries(materials) as [Material, number][]) next[name] = (next[name] ?? 0) + n;
      tx.set(stateRef, { ...state, coins: state.coins + coins, materials: next, updatedAt: now });
    }
    for (const { id, item } of items) tx.create(user.collection("inventory").doc(id), item);
  });
  console.log(`Done: ${items.length} item(s)${Object.keys(materials).length ? ", materials" : ""}${coins > 0 ? `, ${coins} coins` : ""} granted.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
