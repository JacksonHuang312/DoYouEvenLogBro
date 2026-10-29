// Prints when a steady player (PACING in src/lib/game/config.ts: 4 workouts a week, 16 working
// sets each) reaches each piece of content, against the design doc's targets (GAME_DESIGN.md 10,
// stat rework), and the XP per level that puts level 35 at the target.
//
//   npm run pacing-table
import { PACING, STATS, XP } from "../src/lib/game/config";
import { milestones } from "../src/lib/game/milestones";
import { simulatePacing, suggestedPerLevel } from "../src/lib/game/pacing";

const run = simulatePacing(52 * 4);
const months = (m: number | null) => (m == null ? "-" : m.toFixed(1)).padStart(6);
const n = (x: number) => String(Math.round(x)).padStart(6);

console.log(`Steady player: ${PACING.workoutsPerWeek} workouts a week, XP per level ${XP.perLevel}\n`);
console.log(" month  avg stat  body  gear battle level");
for (const m of [1, 3, 6, 9, 12, 18, 24, 30, 36, 48]) {
  const w = run[Math.round((m * 52) / 12) - 1];
  const avg = STATS.reduce((sum, s) => sum + w.stats[s], 0) / STATS.length;
  console.log(`${String(m).padStart(6)}  ${n(avg)}   ${n(w.body)}${n(w.gear)}${n(w.battle)}${n(w.level)}`);
}
console.log("\nDoc targets: each stat about 28 at 6 months, 55 at 1 year, 110 at 2 years; battle about 460 at 1 year, 900 at 2.\n");

console.log("Milestone                  target  model");
for (const m of milestones(run)) console.log(`${m.name.padEnd(25)}${months(m.target)} ${months(m.months)}`);
console.log(`\nXP per level for level 35 at ${PACING.targets.level35} months: ${suggestedPerLevel()}`);
