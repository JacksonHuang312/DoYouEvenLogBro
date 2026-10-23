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

  // Found by this suite: the shop's stock is computed on the device, but the screen only trusts a
  // shop doc the server has confirmed. A user who has never bought or rerolled has no doc, so offline
  // they get "can't load" instead of disabled buttons. Update this test if that behaviour changes.
  test("Shop without a shop doc says it can't load while offline", async ({ hero, page, context }) => {
    await hero.start(undefined, "Gear");
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await hero.openTab("Shop");
    await expect(page.getByText("Can't load the shop right now.", { exact: false })).toBeVisible();
  });
});
