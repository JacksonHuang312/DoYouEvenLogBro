import { execFileSync } from "node:child_process";
import path from "node:path";
import { adminDb } from "../src/lib/server/admin";
import { expect, test } from "./fixtures";
import { expectNoOverflow, expectTapTargets, shot } from "./helpers";
import { BENCH_ID, HERO } from "./seed";

const user = () => adminDb().collection("users").doc(HERO.uid);

/** Saves a bench workout `daysAgo` days ago with four sets of `weightKg` × 5. */
async function saveBench(id: string, weightKg: number, daysAgo: number) {
  const startedAt = Date.now() - daysAgo * 86_400_000;
  const sets = Array.from({ length: 4 }, () => ({ type: "normal", weightKg, reps: 5 }));
  await user().collection("workouts").doc(id).set({
    name: "Push day",
    startedAt,
    endedAt: startedAt + 3_600_000,
    exercises: [{ exerciseId: BENCH_ID, name: "Barbell Bench Press - Medium Grip", sets }],
    exerciseIds: [BENCH_ID],
    volumeKg: 4 * 5 * weightKg,
    setCount: 4,
  });
}

test.describe("Stats tab (stat rework)", () => {
  test("lays out at 390px: stats from training, no calibration, breakdown by muscle", async ({ hero, page }, info) => {
    await hero.start(undefined, "Stats");
    await expect(page.getByText("Calibrating", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Rusty", { exact: false })).toHaveCount(0);
    // The seed has about 30 in every stat.
    const chest = page.getByRole("button", { name: /^Chest/ });
    await expect(chest).toContainText("30");
    await page.getByRole("button", { name: /^Back/ }).click();
    const breakdown = page.locator("#breakdown-back");
    await expect(breakdown).toContainText("Score");
    await expect(breakdown).not.toContainText("Weight");
    await expect(breakdown).toContainText("lats");
    await shot(page, "stats-tab");
    await expectNoOverflow(page, "Stats tab", info);
    await expectTapTargets(page.getByRole("tabpanel"), "Stats tab", info);
  });

  test("untrained for weeks: a rust line, stats unchanged", async ({ hero, page }, info) => {
    await hero.start({ trainedDaysAgo: 30 }, "Stats");
    // 30 days untrained: 17 days past the 14-day grace, so −17% on every stat.
    await expect(page.getByText("Rusty: Chest −17%", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Chest/ })).toContainText("30");
    await shot(page, "stats-rusty");
    await expectNoOverflow(page, "Stats tab, rusty", info);
  });

  test("a claim that beats the last session pays 1.25 a set; recompute replays the history", async ({ hero }) => {
    await hero.start({ lastBench: { weightKg: 80, reps: [5, 5, 5, 5] } }, "Stats");
    await saveBench("e2e-heavier", 82.5, 0);

    const claim = await hero.api("/api/claim", { workoutId: "e2e-heavier", timeZone: "America/Toronto" });
    expect(claim.status).toBe(200);
    const result = claim.json.result as { progressed: unknown[]; stats: { before: { chest: number }; after: { chest: number } } };
    expect(result.progressed).toEqual([{ exerciseId: BENCH_ID, stat: "chest" }]);
    expect(Math.round((result.stats.after.chest - result.stats.before.chest) * 10) / 10).toBe(0.5);

    // Recompute rebuilds from the two real workouts only (the seed's facts are synthetic): 0.4 + 0.5.
    const recompute = await hero.api("/api/recompute", {});
    expect(recompute.status).toBe(200);
    expect((recompute.json.stats as { chest: number }).chest).toBe(0.9);
  });

  test("backfill --rework moves an old game onto the new rules", async ({ hero }) => {
    await hero.start({ lastBench: { weightKg: 80, reps: [5, 5, 5, 5] } }, "Stats");
    await saveBench("e2e-heavier", 82.5, 1);
    await user().collection("game").doc("state").update({ calibration: { done: true }, bodyweightKg: 80, sex: "male", peakPower: 999 });

    execFileSync("npx", ["tsx", "scripts/backfill-game.ts", "--rework", "--uid", HERO.uid], {
      cwd: path.resolve(__dirname, ".."),
      env: process.env,
      shell: true,
      stdio: "pipe",
    });

    const state = (await user().collection("game").doc("state").get()).data()!;
    expect(state).not.toHaveProperty("calibration");
    expect(state).not.toHaveProperty("bodyweightKg");
    expect(state.peakPower).toBeCloseTo(0.9);
    expect(state.mostStatsBeaten).toBe(1);
    expect(state.coins).toBe(5000);
    // Two workouts a day apart: workout XP twice, plus 10 per point of power (0.9 in all).
    expect(state.xp).toBe(2 * 20 + 9);
    expect(state.level).toBe(2);
    const muscles = (await user().collection("game").doc("muscles").get()).data()!.muscles;
    expect(muscles.chest).toMatchObject({ sets: 8, progressed: 4 });
  });
});
