import type { Page } from "@playwright/test";
import { adminDb } from "../src/lib/server/admin";
import { expect, test } from "./fixtures";
import { expectNoOverflow, expectTapTargets, shot } from "./helpers";
import { HERO } from "./seed";

const picker = (page: Page) => page.getByRole("dialog", { name: /^(Set \d+|Warm-up set|Drop set|Failure set)$/ });
const firstSet = (page: Page) => page.getByRole("button", { name: /^Set 1\b|^Set W\b/ }).first();

async function startRoutine(hero: { start: (o?: object) => Promise<void> }, page: Page) {
  await hero.start({ unit: "kg", routine: true, lastBench: { weightKg: 60, reps: [9, 9, 9] } });
  await page.goto("/workout");
  await page.getByRole("button", { name: "Start Routine" }).click();
  await expect(page.getByRole("heading", { name: "Barbell Bench Press - Medium Grip" })).toBeVisible();
}

test.describe("Set type and effort picker (RPE / RIR)", () => {
  test("tapping the set number opens the picker; RPE and type apply at once", async ({ hero, page }, info) => {
    await startRoutine(hero, page);
    await firstSet(page).click();
    const sheet = picker(page);
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Set 1" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
    await sheet.getByRole("group", { name: "RPE" }).getByRole("button", { name: "8", exact: true }).click();
    await expect(firstSet(page)).toContainText("@8");
    await shot(page, "set-picker");
    await expectNoOverflow(page, "Set picker", info);
    await expectTapTargets(sheet, "Set picker", info);

    await sheet.getByRole("button", { name: "Warm-up" }).click();
    await expect(sheet.getByRole("heading", { name: "Warm-up set" })).toBeVisible();
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: /^Set W, warmup, RPE 8/ })).toContainText("W");
    await shot(page, "workout-with-rpe");
    await expectNoOverflow(page, "Workout with RPE", info);

    // Clearing it removes the effort line.
    await page.getByRole("button", { name: /^Set W/ }).click();
    await picker(page).getByRole("button", { name: "None" }).click();
    await picker(page).getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: /^Set W/ })).not.toContainText("@");
  });

  test("Settings switches to reps in reserve, on the workout and saved views", async ({ hero, page }, info) => {
    await startRoutine(hero, page);
    await firstSet(page).click();
    await picker(page).getByRole("group", { name: "RPE" }).getByRole("button", { name: "8", exact: true }).click();
    await picker(page).getByRole("button", { name: "Done" }).click();

    await page.goto("/settings");
    await page.getByRole("group", { name: "Set effort" }).getByRole("button", { name: "RIR" }).click();
    await expect(page.getByRole("group", { name: "Set effort" }).getByRole("button", { name: "RIR" })).toHaveAttribute("aria-pressed", "true");
    await shot(page, "settings-effort");
    await expectNoOverflow(page, "Settings", info);

    // The draft is kept, and now reads in reps in reserve.
    await page.goto("/workout");
    await expect(firstSet(page)).toContainText("2 RIR");
    await firstSet(page).click();
    const rir = picker(page).getByRole("group", { name: "Reps in reserve" });
    await expect(rir.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-pressed", "true");
    await picker(page).getByRole("button", { name: "Done" }).click();

    // A saved set with an RPE shows it in the viewer's scale.
    const ref = adminDb().collection("users").doc(HERO.uid).collection("workouts").doc("e2e-last-bench");
    const saved = (await ref.get()).data()!;
    saved.exercises[0].sets[0].rpe = 9;
    await ref.set(saved);
    await page.goto(`/w/${HERO.uid}/e2e-last-bench`);
    await expect(page.getByText("60 kg × 9 · 1 RIR")).toBeVisible();
    await expectNoOverflow(page, "Saved workout with RIR", info);
  });
});
