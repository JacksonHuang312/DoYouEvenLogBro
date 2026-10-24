import { expect, test } from "./fixtures";
import { expectNoOverflow, shot } from "./helpers";

test.describe("Offline mode", () => {
  test("Gear, Shop and Titles turn their buttons off and say why", async ({ hero, page, context }, info) => {
    await hero.start({ shopDoc: true }, "Titles");
    // Visit each tab online first so its data is cached (Firestore's offline cache, as on a phone at the gym).
    await hero.openTab("Shop");
    await expect(page.getByRole("button", { name: /^Buy · / })).toHaveCount(6);
    await hero.openTab("Gear");
    await expect(page.getByRole("heading", { name: "Equipment" })).toBeVisible();
    await hero.openTab("Titles");
    await expect(page.getByText("Progress unavailable")).toHaveCount(0);

    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

    // Titles: slot purchase off, equip off.
    await expect(page.getByText("Changing titles and buying slots need a connection.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Buy slot 2/ })).toBeDisabled();
    for (const button of await page.getByRole("tabpanel").getByRole("button", { name: /^(Equip|Unequip)$/ }).all()) {
      await expect(button).toBeDisabled();
    }
    await shot(page, "offline-titles");
    await expectNoOverflow(page, "Offline Titles", info);

    // Shop: buying and rerolling off.
    await hero.openTab("Shop");
    await expect(page.getByText("Buying and rerolling need a connection.", { exact: false })).toBeVisible();
    for (const button of await page.getByRole("button", { name: /^Buy · / }).all()) await expect(button).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Reroll for/ })).toBeDisabled();
    await shot(page, "offline-shop");
    await expectNoOverflow(page, "Offline Shop", info);

    // Gear: the tab and a slot sheet both warn, and every action is off.
    await hero.openTab("Gear");
    await expect(page.getByText("Equipping, upgrading, selling and salvaging need a connection.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: /^Ring 1\b/ }).click();
    const sheet = page.getByRole("dialog", { name: "Ring 1", exact: true });
    await expect(sheet.getByText("Gear changes need a connection.", { exact: false })).toBeVisible();
    for (const button of await sheet.getByRole("listitem").getByRole("button").all()) await expect(button).toBeDisabled();
    await shot(page, "offline-gear-sheet", { full: false });
    await expectNoOverflow(page, "Offline ring sheet", info);
    await sheet.getByRole("button", { name: "Close" }).click();

    // Back online: everything turns back on.
    await context.setOffline(false);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
    await expect(page.getByText("need a connection.", { exact: false })).toHaveCount(0);
    await hero.openTab("Shop");
    await expect(page.getByRole("button", { name: "Reroll for 100 coins" })).toBeEnabled();
    await expect(page.getByRole("button", { name: /^Buy · / }).first()).toBeEnabled();
  });

  // Found by an earlier run of this suite: a user who has never bought or rerolled has no shop doc, so
  // offline the shop used to say "can't load". The stock is computed from the week, so it now shows
  // with the buttons off.
  test("Shop without a shop doc still shows the week's stock while offline", async ({ hero, page, context }, info) => {
    await hero.start(undefined, "Gear");
    // Let the hero's own data load (and cache) first, as it has on a phone that reopens offline.
    await expect(page.getByRole("heading", { name: "Equipment" })).toBeVisible();
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await hero.openTab("Shop");
    // The shop waits 8 seconds for an answer before treating the missing doc as unavailable.
    await expect(page.getByText("This is this week's stock", { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Buying and rerolling need a connection.", { exact: false })).toBeVisible();
    const buy = page.getByRole("button", { name: /^Buy · / });
    await expect(buy).toHaveCount(6);
    for (const button of await buy.all()) await expect(button).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Reroll for/ })).toBeDisabled();
    await expect(page.getByText("Can't load the shop")).toHaveCount(0);
    await shot(page, "offline-shop-no-doc");
    await expectNoOverflow(page, "Offline Shop without a doc", info);
  });
});
