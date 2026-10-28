// Prints win chances by class, boss type and power ratio, for tuning the combat numbers in
// src/lib/game/config.ts (COMBAT, CLASSES, SKILLS). A hero "at 1.0" has exactly the boss's
// recommended battle power. Target: about 65% at 1.0, rising smoothly with power.
//
//   npm run combat-table
//   npm run combat-table -- --runs 2000
import { parseArgs } from "node:util";
import { CLASS_IDS } from "../src/lib/game/config";
import { buildFoe, simulateFight } from "../src/lib/game/combat";
import { ARCHETYPES, balancedHero, winRate } from "../src/lib/game/combatTuning";

const { values } = parseArgs({ options: { runs: { type: "string", default: "600" } } });
const runs = Number(values.runs);
const RATIOS = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3];
const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(5);

console.log(`Win chance by power ratio (${runs} fights each)\n`);
for (const [type, mechanics] of Object.entries(ARCHETYPES)) {
  console.log(`${type.toUpperCase()}`);
  console.log(`  class      ${RATIOS.map((r) => `${r.toFixed(1)}x`.padStart(5)).join(" ")}`);
  for (const classId of CLASS_IDS) {
    const row = RATIOS.map((ratio) => pct(winRate({ classId, ratio, mechanics, runs })));
    console.log(`  ${classId.padEnd(9)}  ${row.join(" ")}`);
  }
  console.log();
}

// One sample fight per class against a brute, to see the pace.
for (const classId of CLASS_IDS) {
  const r = simulateFight(balancedHero(350, classId), buildFoe("Brute", 350, ARCHETYPES.brute), "sample");
  console.log(`${classId}: ${r.won ? "won" : "lost"} (${r.end}) in ${r.seconds}s, dealt ${r.stats.dealt}, took ${r.stats.taken}, healed ${r.stats.healed}`);
}
