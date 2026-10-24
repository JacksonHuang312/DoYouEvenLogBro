import type { Page } from "@playwright/test";
import { adminDb } from "../src/lib/server/admin";
import { expect, test } from "./fixtures";
import { expectNoOverflow, shot } from "./helpers";
import { HERO, ROUTINE_ID, type SeedOptions } from "./seed";

const hint = (page: Page) => page.locator("[data-hint]");
const editButton = (page: Page) => page.getByRole("button", { name: /^Edit target reps for/ });
const min = (page: Page) => page.getByRole("textbox", { name: /^Minimum reps for/ });
const max = (page: Page) => page.getByRole("textbox", { name: /^Maximum reps for/ });

async function storedExercise() {
  const snap = await adminDb().collection("users").doc(HERO.uid).collection("routines").doc(ROUTINE_ID).get();
  return (snap.data() as { exercises: Record<string, unknown>[] }).exercises[0];
}

async function startRoutine(hero: { start: (o?: SeedOptions) => Promise<void> }, page: Page, options: SeedOptions) {
  await hero.start({ unit: "kg", routine: { repMin: 6, repMax: 9 }, ...options });
  await page.goto("/workout");
  await page.getByRole("button", { name: "Start Routine" }).click();
  await expect(page.getByRole("heading", { name: "Barbell Bench Press - Medium Grip" })).toBeVisible();
}

test.describe("Workout screen: target reps and hint", () => {
  test("shows the target and an add-weight hint when every set reached the top", async ({ hero, page }, info) => {
    await startRoutine(hero, page, { lastBench: { weightKg: 60, reps: [9, 9, 9] } });
    await expect(page.getByText("Target 6–9 reps")).toBeVisible();
    await expect(hint(page)).toHaveText("Last time: 9, 9, 9 at 60 kg. Try 62.5 kg.");
    await expect(hint(page)).toHaveAttribute("data-hint", "add-weight");
    await shot(page, "workout-target-hint");
    await expectNoOverflow(page, "Workout with a target", info);
  });

  test("a set under the minimum suggests a lighter weight, without calling it a failure", async ({ hero, page }) => {
    await startRoutine(hero, page, { lastBench: { weightKg: 60, reps: [9, 5] } });
    await expect(hint(page)).toHaveText("Last time: 9, 5 at 60 kg. Under your 6-9 range. Try 57.5 kg.");
    await expect(hint(page)).toHaveAttribute("data-hint", "lighter");
  });

  test("in range says to aim for the top", async ({ hero, page }) => {
    await startRoutine(hero, page, { lastBench: { weightKg: 60, reps: [9, 8, 7] } });
    await expect(hint(page)).toHaveText("Last time: 9, 8, 7 at 60 kg. Aim for 9 on every set.");
  });

  test("with no past workout there is a target but no hint", async ({ hero, page }) => {
    await startRoutine(hero, page, {});
    await expect(page.getByText("Target 6–9 reps")).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
  });

  test("changing the range mid-workout updates the hint and saves to the routine", async ({ hero, page }, info) => {
    await startRoutine(hero, page, { lastBench: { weightKg: 60, reps: [9, 9, 9] } });
    await editButton(page).click();
    await expect(page.getByText("Saved to your routine for next time.", { exact: false })).toBeVisible();
    await shot(page, "workout-target-editor");
    await expectNoOverflow(page, "Target editor", info);

    await min(page).fill("8");
    await max(page).fill("12");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Target 8–12 reps")).toBeVisible();
    await expect(hint(page)).toHaveText("Last time: 9, 9, 9 at 60 kg. Aim for 12 on every set.");

    await expect.poll(async () => (await storedExercise()).repMax).toBe(12);
    expect((await storedExercise()).repMin).toBe(8);
  });

  test("a bad range can't be saved, and clearing both ends removes the target everywhere", async ({ hero, page }) => {
    await startRoutine(hero, page, { lastBench: { weightKg: 60, reps: [9, 9, 9] } });
    await editButton(page).click();
    await min(page).fill("10");
    await max(page).fill("9");
    await expect(page.locator("p[role=alert]")).toContainText("can't be higher than the maximum");
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();

    await min(page).fill("");
    await max(page).fill("");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Set target reps for/ })).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
    await expect.poll(async () => "repMin" in (await storedExercise())).toBe(false);
    expect("repMax" in (await storedExercise())).toBe(false);
  });

  test("logging a set still works exactly as before", async ({ hero, page }) => {
    await startRoutine(hero, page, { lastBench: { weightKg: 60, reps: [9, 9, 9] } });
    await page.getByRole("textbox", { name: "Weight" }).first().fill("62.5");
    await page.getByRole("textbox", { name: "Reps" }).first().fill("9");
    await page.getByRole("button", { name: "Mark set done" }).first().click();
    await expect(page.getByRole("button", { name: "Mark set not done" }).first()).toHaveAttribute("aria-pressed", "true");
  });
});
