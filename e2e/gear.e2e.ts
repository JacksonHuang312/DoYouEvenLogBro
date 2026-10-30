import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expectNoOverflow, expectTapTargets, numberBefore, shot } from "./helpers";
import { ITEM_IDS } from "./seed";

const row = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^${label}\\b`) });
const sheet = (page: Page, label: string) => page.getByRole("dialog", { name: label, exact: true });
const cardOf = (page: Page, label: string, name: string | RegExp) => sheet(page, label).getByRole("listitem").filter({ hasText: name });

/** The "Battle 1,234" number in the Hero header line. */
const battle = async (page: Page) => Number(((await page.locator("header").first().innerText()).match(/Battle ([\d,]+)/) ?? [])[1]?.replaceAll(",", ""));

async function closeSheet(page: Page, label: string) {
  await sheet(page, label).getByRole("button", { name: "Close" }).click();
  await expect(sheet(page, label)).toBeHidden();
}

test.describe("Gear tab", () => {
  test("lays out at 390px: power, equipment, accessories", async ({ hero, page }, info) => {
    await hero.start(undefined, "Gear");
    await expect(page.getByRole("heading", { name: "Power" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Equipment" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Accessories" })).toBeVisible();
    for (const label of ["Helmet", "Chestplate", "Gloves", "Leggings", "Boots", "Ring 1", "Ring 2", "Necklace", "Belt", "Charm 1", "Charm 2"]) {
      await expect(row(page, label)).toBeVisible();
    }
    // Five rings in the seed: the helmet row says 1 owned, both ring rows say 5.
    await expect(row(page, "Ring 1")).toContainText("5 owned");
    await expect(row(page, "Helmet")).toContainText("1 owned");
    await expect(page.getByText("Body", { exact: true })).toBeVisible();
    await shot(page, "gear-tab");
    await expectNoOverflow(page, "Gear tab", info);
    await expectTapTargets(page.getByRole("tabpanel"), "Gear tab", info);
  });

  test("a slot sheet stacks identical copies as ×N", async ({ hero, page }, info) => {
    await hero.start(undefined, "Gear");
    await row(page, "Ring 1").click();
    await expect(sheet(page, "Ring 1")).toBeVisible();
    // Two Silver Loops are one card marked ×2; the other three rings are separate cards.
    const loops = cardOf(page, "Ring 1", "Silver Loop");
    await expect(loops).toHaveCount(1);
    await expect(loops).toContainText("×2");
    // No +0, no helper lines under the buttons, and the upgrade preview is gone.
    await expect(sheet(page, "Ring 1")).not.toContainText(/\+0(?![.\d])/); // no "+0" upgrade level (an effect may read "+0.5%")
    await expect(sheet(page, "Ring 1")).not.toContainText("act on one of your");
    await expect(sheet(page, "Ring 1")).not.toContainText("Named gear can't be sold");
    await expect(sheet(page, "Ring 1")).not.toContainText("→");
    await expect(sheet(page, "Ring 1").getByRole("listitem")).toHaveCount(4);
    await shot(page, "gear-ring-sheet", { full: false });
    await expectNoOverflow(page, "Ring sheet", info);
    await expectTapTargets(sheet(page, "Ring 1"), "Ring sheet", info);
  });

  test("equip across ring1 and ring2, then unequip", async ({ hero, page }) => {
    await hero.start(undefined, "Gear");
    // The header shows Battle once the inventory has loaded.
    await expect.poll(() => battle(page)).toBeGreaterThan(0);
    const before = await battle(page);

    await row(page, "Ring 1").click();
    await cardOf(page, "Ring 1", "Silver Loop").first().getByRole("button", { name: "Equip", exact: true }).click();
    // The worn copy and the leftover copy are now two separate Silver Loop cards.
    await expect(cardOf(page, "Ring 1", "Silver Loop")).toHaveCount(2);
    await closeSheet(page, "Ring 1");
    await expect(row(page, "Ring 1")).toContainText("Silver Loop");
    await expect(row(page, "Ring 2")).toContainText("Nothing equipped");
    await expect.poll(() => battle(page)).toBeGreaterThan(before);
    const withOne = await battle(page);

    await row(page, "Ring 2").click();
    const spare = cardOf(page, "Ring 2", "Silver Loop").filter({ has: page.getByRole("button", { name: "Equip", exact: true }) });
    await expect(spare).toHaveCount(1);
    await spare.getByRole("button", { name: "Equip", exact: true }).click();
    await closeSheet(page, "Ring 2");
    await expect(row(page, "Ring 1")).toContainText("Silver Loop");
    await expect(row(page, "Ring 2")).toContainText("Silver Loop");
    await expect.poll(() => battle(page)).toBeGreaterThan(withOne);

    // Unequip ring 2 again.
    await row(page, "Ring 2").click();
    await cardOf(page, "Ring 2", "Ring 2").getByRole("button", { name: "Unequip" }).click();
    await closeSheet(page, "Ring 2");
    await expect(row(page, "Ring 2")).toContainText("Nothing equipped");
    await expect(row(page, "Ring 1")).toContainText("Silver Loop");
  });

  test("the same item can't be worn in two positions", async ({ hero, page }) => {
    await hero.start(undefined, "Gear");
    expect((await hero.api("/api/items", { action: "equip", itemId: ITEM_IDS.loopA, position: "ring1" })).status).toBe(200);

    const second = await hero.api("/api/items", { action: "equip", itemId: ITEM_IDS.loopA, position: "ring2" });
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.json.error).toMatch(/already equipped in another position/i);

    // A different slot's position is refused too, and nothing leaked into ring 2.
    const wrongSlot = await hero.api("/api/items", { action: "equip", itemId: ITEM_IDS.loopA, position: "necklace" });
    expect(wrongSlot.status).toBeGreaterThanOrEqual(400);
    await page.reload();
    await hero.openTab("Gear");
    await expect(row(page, "Ring 1")).toContainText("Silver Loop");
    await expect(row(page, "Ring 2")).toContainText("Nothing equipped");
    await expect(row(page, "Necklace")).toContainText("Empty");

    // The other identical copy is free to go in ring 2.
    expect((await hero.api("/api/items", { action: "equip", itemId: ITEM_IDS.loopB, position: "ring2" })).status).toBe(200);
  });

  test("an equipped item can't be sold or salvaged", async ({ hero }) => {
    await hero.start(undefined, "Gear");
    await hero.api("/api/items", { action: "equip", itemId: ITEM_IDS.loopA, position: "ring1" });
    for (const action of ["sell", "salvage"]) {
      const res = await hero.api("/api/items", { action, itemId: ITEM_IDS.loopA });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.json.error).toMatch(/unequip it first/i);
    }
  });

  test("selling one copy of a stack keeps the other", async ({ hero, page }, info) => {
    await hero.start(undefined, "Gear");
    await row(page, "Ring 1").click();
    const loops = cardOf(page, "Ring 1", "Silver Loop");
    await expect(loops).toContainText("×2");
    const header = sheet(page, "Ring 1").getByText(/coins · .* scrap/);
    const coinsBefore = numberBefore(await header.innerText(), "coins");
    const price = Number((await loops.getByRole("button", { name: /^Sell/ }).innerText()).match(/([\d,]+)/)![1].replaceAll(",", ""));

    await loops.getByRole("button", { name: /^Sell/ }).click();
    const confirm = page.getByRole("dialog", { name: "Sell Silver Loop?" });
    await expect(confirm).toContainText("You keep your other 1");
    await shot(page, "gear-sell-confirm", { full: false });
    await expectNoOverflow(page, "Sell confirm", info);
    // Cancel first: nothing changes.
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(loops).toContainText("×2");

    await loops.getByRole("button", { name: /^Sell/ }).click();
    await page.getByRole("dialog", { name: "Sell Silver Loop?" }).getByRole("button", { name: /^Sell for/ }).click();
    await expect(cardOf(page, "Ring 1", "Silver Loop")).not.toContainText("×");
    await expect(cardOf(page, "Ring 1", "Silver Loop")).toHaveCount(1);
    expect(numberBefore(await header.innerText(), "coins")).toBe(coinsBefore + price);
  });

  test("salvaging one copy of a stack gives scrap and keeps the other", async ({ hero, page }) => {
    await hero.start(undefined, "Gear");
    await row(page, "Ring 1").click();
    const loops = cardOf(page, "Ring 1", "Silver Loop");
    const header = sheet(page, "Ring 1").getByText(/coins · .* scrap/);
    const scrapBefore = numberBefore(await header.innerText(), "scrap");
    const gain = Number((await loops.getByRole("button", { name: /^Salvage/ }).innerText()).match(/\+([\d,]+)/)![1]);

    await loops.getByRole("button", { name: /^Salvage/ }).click();
    await page.getByRole("dialog", { name: "Salvage Silver Loop?" }).getByRole("button", { name: /^Salvage for/ }).click();
    await expect(cardOf(page, "Ring 1", "Silver Loop")).not.toContainText("×");
    expect(numberBefore(await header.innerText(), "scrap")).toBe(scrapBefore + gain);
    await closeSheet(page, "Ring 1");
    await expect(row(page, "Ring 1")).toContainText("4 owned");
  });

  test("named gear is salvage-only", async ({ hero, page }) => {
    await hero.start(undefined, "Gear");
    await row(page, "Ring 1").click();
    const named = cardOf(page, "Ring 1", "Sunforged Ring");
    await expect(named.getByRole("button", { name: "Can't sell" })).toBeDisabled();
    await expect(named.getByRole("button", { name: /^Salvage/ })).toBeEnabled();
  });

  test("a low level shows what is locked", async ({ hero, page }) => {
    await hero.start({ level: 1 }, "Gear");
    await row(page, "Ring 1").click();
    const epic = cardOf(page, "Ring 1", "Gold Seal");
    // The level sits on the Equip button as a lock and a number, not as a line of text.
    const equip = epic.getByRole("button", { name: "Equip, needs level 35" });
    await expect(equip).toBeDisabled();
    await expect(equip).toContainText("8");
    await expect(epic).not.toContainText("Needs level");
    await shot(page, "gear-level-lock", { full: false });
  });
});

test.describe("Gear rows", () => {
  test("an equipped item's details wrap instead of being cut off", async ({ hero, page }) => {
    await hero.start({ gear: ["pot"] }, "Gear");
    expect((await hero.api("/api/items", { action: "equip", itemId: ITEM_IDS.pot, position: "helmet" })).status).toBe(200);
    await page.reload();
    await hero.openTab("Gear");
    const helmet = row(page, "Helmet");
    // Two lines: rarity and power, then the stats, always attack, health, defense.
    await expect(helmet.getByText("Common · 3 power", { exact: true })).toBeVisible();
    await expect(helmet.getByText("ATK 20 / DEF 80", { exact: true })).toBeVisible();
    const first = await helmet.getByText("Common · 3 power", { exact: true }).boundingBox();
    const second = await helmet.getByText("ATK 20 / DEF 80", { exact: true }).boundingBox();
    expect(second!.y).toBeGreaterThan(first!.y + first!.height - 1);
    // Nothing inside the row is clipped: no text wider than its box.
    const clipped = await helmet.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>("span")].filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.innerText),
    );
    expect(clipped).toEqual([]);
    await shot(page, "gear-row-wrap", { full: false });
  });
});

test.describe("Gear card wording", () => {
  test("shows (+1) after an upgrade and nothing at +0", async ({ hero, page }) => {
    await hero.start(undefined, "Gear");
    await row(page, "Ring 1").click();
    const card = cardOf(page, "Ring 1", "Copper Band");
    await expect(card).toContainText("Common · 1 power");
    await card.getByRole("button", { name: "Upgrade" }).click();
    await page.getByRole("dialog", { name: "Upgrade Copper Band?" }).getByRole("button", { name: "Upgrade" }).click();
    await expect(cardOf(page, "Ring 1", "Copper Band")).toContainText("Common (+1)");
  });

  test("a disabled Upgrade says why, and an equipped item says to unequip first", async ({ hero, page }) => {
    await hero.start({ scrap: 0 }, "Gear");
    await row(page, "Ring 1").click();
    const card = cardOf(page, "Ring 1", "Gold Seal");
    await expect(card.getByRole("button", { name: "Upgrade" })).toBeDisabled();
    await expect(card).toContainText(/scrap/i);

    await card.getByRole("button", { name: "Equip", exact: true }).click();
    await expect(cardOf(page, "Ring 1", "Ring 1")).toContainText("Unequip it to sell or salvage it.");
  });
});
