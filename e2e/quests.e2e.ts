import { expect, test } from "./fixtures";
import { expectNoOverflow, shot } from "./helpers";

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
