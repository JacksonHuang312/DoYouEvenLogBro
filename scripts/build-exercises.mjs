// Downloads free-exercise-db (public domain) and writes a trimmed copy to src/data/exercises.json.
// Run with: node scripts/build-exercises.mjs
import { writeFile } from "node:fs/promises";

const SOURCE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const raw = await res.json();

const exercises = raw
  .filter((e) => e.category !== "stretching")
  .map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    equipment: e.equipment ?? "other",
    muscle: e.primaryMuscles?.[0] ?? "other",
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

await writeFile(
  new URL("../src/data/exercises.json", import.meta.url),
  JSON.stringify(exercises) + "\n",
);
console.log(`Wrote ${exercises.length} exercises`);
