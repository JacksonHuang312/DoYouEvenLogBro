// Reads the stored fight records and prints what real fights say (GAME_DESIGN.md 13.11, 13.24):
// win rates per enemy, months to the first win at each weekly tier, and coins from fights.
// Read-only: it never writes.
//
// Emulator only for now: it refuses to run unless the Firestore emulator is set and the project
// is a demo-* one, so it can't read the real project. Reading production comes later (13.11).
//
//   npm run emulators            # in one terminal, with some fights played (npm run dev:emu)
//   npm run fight-report         # every user
//   npm run fight-report -- --uid emulator-har
import { parseArgs } from "node:util";
import type { GameState } from "../src/lib/game/claim";
import { fightReport, reportLines, type ReportPlayer } from "../src/lib/game/fightReport";
import type { FightRecord } from "../src/lib/server/fights";

// The usual emulator port unless the environment already points elsewhere; only this machine's.
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST))
  throw new Error(`Refusing to read ${process.env.FIRESTORE_EMULATOR_HOST}: only local emulators.`);
Object.assign(process.env, {
  NEXT_PUBLIC_FIREBASE_EMULATOR: "1",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-dyelb",
  FIREBASE_ADMIN_PROJECT_ID: "demo-dyelb",
});

const { values } = parseArgs({ options: { uid: { type: "string" } } });

async function main() {
  // Imported after the environment is set, because the admin SDK reads it on load.
  const { adminDb } = await import("../src/lib/server/admin");
  const { gameRefs } = await import("../src/lib/server/refs");
  const db = adminDb();
  // listDocuments also finds users that only have subcollections.
  const users = values.uid ? [db.collection("users").doc(values.uid)] : await db.collection("users").listDocuments();

  const players: ReportPlayer[] = [];
  for (const user of users) {
    const r = gameRefs(db, user.id);
    const [state, fights] = await Promise.all([r.state.get(), r.fights.orderBy("at").get()]);
    players.push({
      uid: user.id,
      startedAt: state.exists ? ((state.data() as GameState).createdAt ?? null) : null,
      fights: fights.docs.map((d) => d.data() as FightRecord),
    });
  }
  console.log(reportLines(fightReport(players)).join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
