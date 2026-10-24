import type { Page } from "@playwright/test";
import { adminDb } from "../src/lib/server/admin";
import { expect, test } from "./fixtures";
import { expectNoOverflow, shot } from "./helpers";
import { HERO, ROUTINE_ID } from "./seed";

const min = (page: Page) => page.getByRole("textbox", { name: /^Minimum reps for/ });
const max = (page: Page) => page.getByRole("textbox", { name: /^Maximum reps for/ });
const step = (page: Page) => page.getByRole("textbox", { name: /^Weight step for/ });
// Not getByRole("alert") alone: Next adds its own empty route announcer with that role.
const problem = (page: Page) => page.locator("p[role=alert]");
const save = (page: Page) => page.getByRole("button", { name: "Save", exact: true });

async function storedRoutine() {
  const snap = await adminDb().collection("users").doc(HERO.uid).collection("routines").doc(ROUTINE_ID).get();
  return snap.data() as { exercises: Record<string, unknown>[] };
}

async function openEditor(hero: { start: (o?: { routine?: boolean }) => Promise<void> }, page: Page) {
  await hero.start({ routine: true });
  await page.goto(`/routines/${ROUTINE_ID}`);
  await expect(page.getByRole("heading", { name: "Edit Routine" })).toBeVisible();
}

test.describe("Routine editor: target rep range", () => {
  test("has an empty range by default, and a half-typed range blocks saving", async ({ hero, page }, info) => {
    await openEditor(hero, page);
    await expect(page.getByText("Target reps")).toBeVisible();
    await expect(min(page)).toHaveValue("");
    await expect(max(page)).toHaveValue("");
    await expect(step(page)).toHaveCount(0);
    await expect(save(page)).toBeEnabled();
    await shot(page, "routine-editor-empty");

    await min(page).fill("6");
    await expect(problem(page)).toContainText("Set both a minimum and a maximum");
    await expect(save(page)).toBeDisabled();

    await max(page).fill("9");
    await expect(problem(page)).toHaveCount(0);
    await expect(save(page)).toBeEnabled();
    await shot(page, "routine-editor-range");
    await expectNoOverflow(page, "Routine editor with a range", info);
    // The new inputs meet the 44px target. (The rest of this old-style screen, such as the +/- set buttons, is Phase 8's restyle.)
    for (const input of [min(page), max(page)]) expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await expect(step(page)).toBeVisible();
    expect((await step(page).boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  });

  test("a reversed or out-of-bounds range is refused", async ({ hero, page }) => {
    await openEditor(hero, page);
    await min(page).fill("10");
    await max(page).fill("9");
    await expect(problem(page)).toContainText("can't be higher than the maximum");
    await expect(save(page)).toBeDisabled();

    await min(page).fill("0");
    await max(page).fill("9");
    await expect(problem(page)).toContainText("1 to 30");
    await expect(save(page)).toBeDisabled();

    await min(page).fill("6");
    await max(page).fill("31");
    await expect(problem(page)).toContainText("1 to 30");
    await expect(save(page)).toBeDisabled();
  });

  test("the weight step shows once there is a range, in the user's unit, and saves in kg", async ({ hero, page }) => {
    await openEditor(hero, page);
    await min(page).fill("6");
    await max(page).fill("9");
    // The seeded user counts in pounds: the default step is 5 lb.
    await expect(step(page)).toHaveAttribute("placeholder", "5");
    await expect(page.getByText("Target 6-9 reps, adding 5 lb at a time.")).toBeVisible();

    await step(page).fill("10");
    await expect(page.getByText("Target 6-9 reps, adding 10 lb at a time.")).toBeVisible();
    await save(page).click();
    await expect(page).toHaveURL(/\/workout$/);

    await expect.poll(async () => (await storedRoutine()).exercises[0].repMin).toBe(6);
    const saved = (await storedRoutine()).exercises[0];
    expect(saved.repMax).toBe(9);
    expect(saved.stepKg as number).toBeCloseTo(4.5359, 3);
    // The rest of the exercise is untouched.
    expect(saved.sets).toBe(3);
    expect(saved.restSec).toBe(90);
  });

  test("a saved range comes back when the routine is reopened, and clearing it removes every field", async ({ hero, page }) => {
    await openEditor(hero, page);
    await min(page).fill("8");
    await max(page).fill("12");
    await save(page).click();
    await expect(page).toHaveURL(/\/workout$/);
    await expect.poll(async () => (await storedRoutine()).exercises[0].repMax).toBe(12);

    await page.goto(`/routines/${ROUTINE_ID}`);
    await expect(min(page)).toHaveValue("8");
    await expect(max(page)).toHaveValue("12");

    await min(page).fill("");
    await max(page).fill("");
    await expect(step(page)).toHaveCount(0);
    await save(page).click();
    await expect(page).toHaveURL(/\/workout$/);
    await expect.poll(async () => "repMin" in (await storedRoutine()).exercises[0]).toBe(false);
    const cleared = (await storedRoutine()).exercises[0];
    expect("repMax" in cleared).toBe(false);
    expect("stepKg" in cleared).toBe(false);
  });
});
