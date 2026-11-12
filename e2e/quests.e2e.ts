import { expect, test } from "./fixtures";
import { expectNoOverflow, expectTapTargets, shot } from "./helpers";
import { ROUTINE_ID } from "./seed";

test.describe("Quests screen wording", () => {
  test("shows rerolls left, not their prices", async ({ hero, page }, info) => {
    await hero.start();
    await page.goto("/quests");
    await expect(page.getByText("Rerolls left: 2 of 2")).toBeVisible();
    await expect(page.getByText("Rerolls cost")).toHaveCount(0);
    await shot(page, "quests");
    await expectNoOverflow(page, "Quests", info);
  });

  test("the pause and injury explanations are behind an info button", async ({ hero, page }, info) => {
    await hero.start();
    await page.goto("/quests");
    await page.getByRole("button", { name: /^Breaks/ }).click();

    const pauseText = page.getByText("A pause freezes rust and your schedule", { exact: false });
    await expect(pauseText).toBeHidden();
    await page.getByRole("button", { name: "About pausing" }).click();
    await expect(pauseText).toBeVisible();
    await shot(page, "quests-pause-info");
    await page.getByRole("button", { name: "About pausing" }).click();
    await expect(pauseText).toBeHidden();

    const injuryText = page.getByText("Quests skip them and their rust freezes", { exact: false });
    await expect(injuryText).toBeHidden();
    await page.getByRole("button", { name: "About injuries" }).click();
    await expect(injuryText).toBeVisible();
    await expectNoOverflow(page, "Breaks with info open", info);
  });
});

test.describe("Quests calendar (13.25)", () => {
  test("a month of marks at 390px: a past workout day, today, a tapped day's line, and the planned days of a schedule", async ({ hero, page }, info) => {
    await hero.start({ routine: true, lastBench: { weightKg: 80, reps: [5, 5, 5, 5] } });
    await page.goto("/quests");
    const section = page.locator("section").filter({ has: page.getByRole("button", { name: /^Calendar/ }) });
    await page.getByRole("button", { name: /^Calendar/ }).click();
    const grid = section.getByRole("group");
    await expect(grid).toBeVisible();
    // No schedule yet: today is marked, and nothing lies ahead to page to.
    await expect(grid.getByRole("button", { name: /: Today, no workout yet$/ })).toHaveAttribute("aria-pressed", "true");
    await expect(section.getByRole("status")).toContainText("Today, no workout yet");
    await expect(section.getByRole("button", { name: "Later month" })).toBeDisabled();
    await expectNoOverflow(page, "Quests calendar", info);
    await expectTapTargets(section, "Quests calendar", info);

    // The workout from a week ago: in this month, or the one before.
    const done = grid.getByRole("button", { name: /: Workout done$/ });
    if ((await done.count()) === 0) await section.getByRole("button", { name: "Earlier month" }).click();
    await done.first().click();
    await expect(done.first()).toHaveAttribute("aria-pressed", "true");
    await expect(section.getByRole("status")).toContainText("Workout done");

    // With a schedule (it starts tomorrow), the days ahead are planned and name their routine.
    const saved = await hero.api("/api/schedule", { days: { "0": ROUTINE_ID, "1": ROUTINE_ID, "2": ROUTINE_ID, "3": ROUTINE_ID, "4": ROUTINE_ID, "5": ROUTINE_ID, "6": ROUTINE_ID } });
    expect(saved.status).toBe(200);
    await section.getByRole("button", { name: "Later month" }).click();
    const planned = grid.getByRole("button", { name: /: Scheduled$/ });
    await expect(planned.first()).toBeVisible();
    await planned.first().click();
    await expect(section.getByRole("status")).toContainText("Push day · Scheduled");
    await expect(section).toContainText(/\d+ of \d+ scheduled days done/);
    await shot(page, "quests-calendar");
    await expectNoOverflow(page, "Quests calendar with a schedule", info);
    await expectTapTargets(section, "Quests calendar with a schedule", info);
  });
});

test.describe("Train: the last workout line (13.25)", () => {
  test("shows what the last workout's claim paid, and nothing without a claim", async ({ hero, page }, info) => {
    await hero.start({ lastBench: { weightKg: 80, reps: [5, 5, 5, 5] }, lastBenchCoins: 180 });
    await page.goto("/train");
    await expect(page.getByText(/^Last: Push day · .* · \+180 coins$/)).toBeVisible();
    await shot(page, "train-last-coins");
    await expectNoOverflow(page, "Train", info);

    await hero.start({ lastBench: { weightKg: 80, reps: [5, 5, 5, 5] } });
    await page.goto("/train");
    await expect(page.getByText(/^Last: Push day/)).toBeVisible();
    await expect(page.getByText(/^Last: Push day/)).not.toContainText("coins");
  });
});
