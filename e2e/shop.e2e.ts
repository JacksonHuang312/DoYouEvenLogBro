import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expectNoOverflow, expectTapTargets, numberBefore, shot } from "./helpers";

const offers = (page: Page) => page.getByRole("tabpanel").getByRole("listitem");
const coins = async (page: Page) => numberBefore(await page.getByRole("tabpanel").getByText(/^[\d,]+ coins$/).innerText(), "coins");
const names = async (page: Page) => offers(page).locator(".font-rpg-head").allInnerTexts();
const confirmDialog = (page: Page, title: RegExp) => page.getByRole("dialog", { name: title });

test.describe("Shop tab", () => {
  test("shows six offers with prices, the restock line and a reroll", async ({ hero, page }, info) => {
    await hero.start(undefined, "Shop");
    await expect(offers(page)).toHaveCount(6);
    await expect(page.getByText(/Restocks in .* \(Sunday 00:00\)/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Buy · / })).toHaveCount(6);
    await expect(page.getByRole("button", { name: "Reroll for 100 coins" })).toBeEnabled();
    await shot(page, "shop-tab");
    await expectNoOverflow(page, "Shop tab", info);
    await expectTapTargets(page.getByRole("tabpanel"), "Shop tab", info);
  });

  test("buying an offer spends coins and adds it to Gear", async ({ hero, page }, info) => {
    await hero.start(undefined, "Shop");
    const before = await coins(page);
    const first = offers(page).first();
    const price = Number((await first.getByRole("button", { name: /^Buy · / }).innerText()).match(/([\d,]+)/)![1].replaceAll(",", ""));
    const name = (await first.locator(".font-rpg-head").innerText()).trim();

    await first.getByRole("button", { name: /^Buy · / }).click();
    const confirm = confirmDialog(page, new RegExp(`Buy ${name}`));
    await expect(confirm).toContainText(`${price.toLocaleString("en-US")} coins`);
    await shot(page, "shop-buy-confirm", { full: false });
    await expectNoOverflow(page, "Buy confirm", info);
    await confirm.getByRole("button", { name: /^Buy for/ }).click();

    await expect(first).toContainText("Bought · in your Gear");
    await expect.poll(() => coins(page)).toBe(before - price);
    await hero.openTab("Gear");
    // The seed owns 5 rings and 1 helmet; a purchase adds one more somewhere.
    const owned = await page.getByRole("button", { name: /\d+ owned$/ }).allInnerTexts();
    const total = owned.reduce((n, t) => n + Number(t.match(/(\d+) owned/)![1]), 0);
    expect(total).toBeGreaterThanOrEqual(7);
  });

  test("a second tap on Buy while it's in flight can't double-buy", async ({ hero, page }) => {
    await hero.start(undefined, "Shop");
    const before = await coins(page);
    const first = offers(page).first();
    const price = Number((await first.getByRole("button", { name: /^Buy · / }).innerText()).match(/([\d,]+)/)![1].replaceAll(",", ""));
    await first.getByRole("button", { name: /^Buy · / }).click();
    await confirmDialog(page, /^Buy /).getByRole("button", { name: /^Buy for/ }).dblclick();
    await expect(first).toContainText("Bought");
    await expect.poll(() => coins(page)).toBe(before - price);
  });

  test("rerolling replaces the stock and the next reroll costs 200", async ({ hero, page }) => {
    await hero.start(undefined, "Shop");
    const before = await coins(page);
    const stock = await names(page);

    await page.getByRole("button", { name: "Reroll for 100 coins" }).click();
    await confirmDialog(page, /Reroll the shop\?/).getByRole("button", { name: "Reroll for 100" }).click();

    await expect(page.getByRole("button", { name: "Reroll for 200 coins" })).toBeVisible();
    await expect.poll(() => coins(page)).toBe(before - 100);
    expect(await names(page)).not.toEqual(stock);
    await expect(offers(page)).toHaveCount(6);
  });

  test("without enough coins, buying is blocked and says why", async ({ hero, page }) => {
    await hero.start({ coins: 0 }, "Shop");
    const buttons = page.getByRole("button", { name: /^Buy · / });
    await expect(buttons).toHaveCount(6);
    for (const button of await buttons.all()) await expect(button).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Reroll for/ })).toBeDisabled();
    await expect(offers(page).first()).toContainText(/coin/i);
  });
});
