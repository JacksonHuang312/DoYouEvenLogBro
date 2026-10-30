// Seeds the local emulators with a playable test account, so the RPG screens have something to show
// without any logged workouts. Emulator only: it refuses to run unless the Firestore and Auth
// emulators are set and the project is a demo-* one, so it can never touch the real project.
//
//   npm run emulators                     # in one terminal
//   npm run seed:har                      # level 40, about 40 in every stat, no class yet
//   npm run seed:har -- --level 60 --stat 60 --class striker
//   npm run dev:emu          # http://localhost:3200, wired to the emulators
//
// Then sign in through the emulator hook in the browser console:
//   window.__emulatorSignIn("har@test.dev", "password123")
// Emulator data is lost when the emulators stop; run the seed again after a restart.
import { parseArgs } from "node:util";
import { CLASS_IDS, type ClassId } from "../src/lib/game/config";

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

async function main() {
  // Imported after the environment is set, because the admin SDK reads it on load.
  const { resetHero } = await import("../e2e/seed");
  await resetHero({
    who: HAR,
    level,
    statLevel,
    classId: values.class as ClassId | undefined,
    coins: 5000,
    scrap: 300,
    shopDoc: true,
  });
  console.log(
    `Seeded ${HAR.email} / ${HAR.password} (username ${HAR.username}): level ${level}, about ${statLevel} in every stat${values.class ? `, ${values.class}` : ", no class yet"}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
