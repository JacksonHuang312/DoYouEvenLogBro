import { expect, test } from "./fixtures";
import { expectNoOverflow, expectTapTargets, shot } from "./helpers";

test.describe("Titles tab", () => {
  test("lists the eight achievements and one title slot (Calibrated fills it)", async ({ hero, page }, info) => {
    await hero.start(undefined, "Titles");
    await expect(page.getByText("1 of 1 used")).toBeVisible();
    const achievements = page.getByRole("tabpanel").getByRole("listitem");
    await expect(achievements).toHaveCount(8);
    for (const name of ["Calibrated", "Regular", "Unbroken", "Record Breaker", "Questmaster", "Well Rounded", "Iron Habit", "Centurion"]) {
      await expect(achievements.filter({ hasText: name })).toHaveCount(1);
    }
    // Opening the tab asks the server to check progress, which fills in the progress lines.
    await expect(page.getByText("Progress unavailable")).toHaveCount(0);
    await shot(page, "titles-tab");
    await expectNoOverflow(page, "Titles tab", info);
    await expectTapTargets(page.getByRole("tabpanel"), "Titles tab", info);
  });

  test("a newly earned title equips itself, and can be taken off and put back", async ({ hero, page }) => {
    await hero.start(undefined, "Titles");
    // The seed has finished calibration, so opening the tab records Calibrated and wears it in the empty slot.
    const calibrated = page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: "Calibrated" });
    await expect(calibrated).toContainText("Equipped");
    await expect(page.getByText("1 of 1 used")).toBeVisible();
    await calibrated.getByRole("button", { name: "Unequip" }).click();
    await expect(page.getByText("0 of 1 used")).toBeVisible();
    await calibrated.getByRole("button", { name: "Equip", exact: true }).click();
    await expect(page.getByText("1 of 1 used")).toBeVisible();
  });

  test("buying slot 2 costs 500 coins", async ({ hero, page }) => {
    await hero.start({ coins: 600 }, "Titles");
    await page.getByRole("button", { name: "Buy slot 2 · 500 coins" }).click();
    const confirm = page.getByRole("dialog", { name: "Buy a title slot?" });
    await expect(confirm).toContainText("Slot 2 of 3 costs 500 coins");
    await confirm.getByRole("button", { name: "Buy for 500" }).click();
    await expect(page.getByText("1 of 2 used")).toBeVisible();
    // Slot 3 costs 1,500: out of reach with 100 coins left.
    await expect(page.getByRole("button", { name: "Buy slot 3 · 1,500 coins" })).toBeDisabled();
    await hero.openTab("Shop");
    await expect(page.getByText("100 coins")).toBeVisible();
  });

  test("can't buy a slot without the coins", async ({ hero, page }) => {
    await hero.start({ coins: 100 }, "Titles");
    await expect(page.getByRole("button", { name: "Buy slot 2 · 500 coins" })).toBeDisabled();
  });
});
