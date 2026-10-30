import { expect, test } from "./fixtures";
import { expectNoOverflow, expectTapTargets, shot } from "./helpers";

/*
 * The Battle screens (Phase 5 piece 3) at 390px against the emulators: the class pick, the four
 * fight cards, a fight and its result screen, the stat points sheet and energy. The server rules
 * behind them are in fights.e2e.ts.
 */

const confirm = (page: import("@playwright/test").Page, title: RegExp) =>
  page.getByRole("dialog", { name: title });

/** A new fight plays its replay first; skip it to reach the result screen. */
const skipReplay = (page: import("@playwright/test").Page) =>
  page
    .getByRole("dialog", { name: "Fight replay" })
    .getByRole("button", { name: "Skip" })
    .click();

test.describe("Battle tab", () => {
  test("a player without a class picks one first, then sees the four fight cards", async ({
    hero,
    page,
  }, info) => {
    await hero.start({ level: 60 });
    // The Hero tab nudges toward the picker.
    await page.getByRole("link", { name: /Pick your class/ }).click();
    await expect(
      page.getByRole("heading", { name: "Pick your class" }),
    ).toBeVisible();
    await shot(page, "battle-class-pick");
    await expectNoOverflow(page, "Class pick", info);
    await expectTapTargets(page.locator("body"), "Class pick", info);

    await page.getByRole("button", { name: "Become a Striker" }).click();
    await confirm(page, /Become a Striker/)
      .getByRole("button", { name: "Choose" })
      .click();
    for (const title of [
      "Weekly boss",
      "Endless tower",
      "Boss Tower",
      "Campaign",
    ]) {
      await expect(page.getByRole("region", { name: title })).toBeVisible();
    }
    await expect(page.getByText(/Striker · Energy 3 \/ 9/)).toBeVisible();
    await shot(page, "battle-hub");
    await expectNoOverflow(page, "Battle hub", info);
    await expectTapTargets(page.locator("body"), "Battle hub", info);
  });

  test("a Campaign fight shows its result, spends energy and moves on to the next stage", async ({
    hero,
    page,
  }, info) => {
    await hero.start({ level: 60, classId: "striker" });
    await page.goto("/battle");
    const campaign = page.getByRole("region", { name: "Campaign" });
    await expect(campaign).toContainText("Chapter 1, stage 1 of 12");
    await campaign.getByRole("button", { name: /^Fight/ }).click();
    await skipReplay(page);

    const result = page.getByRole("dialog", { name: "Fight result" });
    await expect(result).toBeVisible();
    await expect(result.getByRole("heading")).toHaveText(/Victory|Defeat/);
    await expect(result).toContainText("Fight energy left: 2");
    // The log is collapsed until opened, and lists timestamped events.
    const log = result.getByText(/^Log \(\d+ events\)$/);
    await log.click();
    await expect(
      result
        .getByRole("listitem")
        .filter({ hasText: /^\d+\.\ds/ })
        .first(),
    ).toBeVisible();
    await shot(page, "battle-result");
    await expectNoOverflow(page, "Fight result", info);
    await result.getByRole("button", { name: "Done" }).click();
    await expect(result).toBeHidden();
    await expect(page.getByText(/Energy 2 \/ 9/)).toBeVisible();
  });

  test("with no energy the Campaign and tower say so, and the weekly boss is once a day", async ({
    hero,
    page,
  }) => {
    await hero.start({ level: 60, classId: "vanguard" });
    // Spend the starting 3 energy through the server.
    for (let i = 0; i < 3; i++)
      await hero.api("/api/fight", {
        mode: "campaign",
        requestId: `e2e-energy-${Date.now()}-${i}`,
      });
    await page.goto("/battle");
    const campaign = page.getByRole("region", { name: "Campaign" });
    await expect(
      campaign.getByRole("button", { name: /^Fight/ }),
    ).toBeDisabled();
    await expect(campaign).toContainText(/Out of fight energy/);

    const weekly = page.getByRole("region", { name: "Weekly boss" });
    await weekly.getByRole("button", { name: "Fight" }).click();
    await confirm(page, /Fight the weekly boss/)
      .getByRole("button", { name: "Fight" })
      .click();
    await skipReplay(page);
    await page
      .getByRole("dialog", { name: "Fight result" })
      .getByRole("button", { name: "Done" })
      .click();
    await expect(weekly.getByRole("button", { name: "Fight" })).toBeDisabled();
    await expect(weekly).toContainText(/fought this week's boss today/);
  });

  test("stat points are spent in a draft and applied, and reset for coins", async ({
    hero,
    page,
  }, info) => {
    await hero.start({ level: 11, classId: "cleric", coins: 1000 });
    await page.goto("/battle");
    await page.getByRole("button", { name: /^Points/ }).click();
    const sheet = page.getByRole("dialog", { name: "Stat points" });
    await expect(sheet).toContainText("10");
    await sheet.getByRole("button", { name: "Add a point to Legs" }).click();
    await sheet.getByRole("button", { name: "Add a point to Legs" }).click();
    await expect(sheet).toContainText("2 points · +1% in fights");
    await shot(page, "battle-points", { full: false });
    await expectNoOverflow(page, "Stat points", info);
    await sheet.getByRole("button", { name: "Apply 2 points" }).click();
    await expect(
      sheet.getByRole("button", { name: "Apply", exact: true }),
    ).toBeDisabled();
    await expect(sheet).toContainText("2 points · +1% in fights");

    await sheet.getByRole("button", { name: /^Reset all points/ }).click();
    await confirm(page, /Reset all stat points/)
      .getByRole("button", { name: /^Pay 500/ })
      .click();
    await expect(sheet).toContainText("0 points");
    const state = await hero.api("/api/points", {
      action: "respec",
      expectedSpent: 0,
    });
    expect(state.status).toBe(409);
  });

  test("the class sheet shows the switch cost and the wait", async ({
    hero,
    page,
  }) => {
    await hero.start({ level: 20, classId: "striker", coins: 1000 });
    await page.goto("/battle");
    await page.getByRole("button", { name: /^Class · Striker/ }).click();
    const sheet = page.getByRole("dialog", { name: "Class" });
    await expect(sheet).toContainText("300 coins");
    await sheet.getByRole("button", { name: "Switch to Cleric" }).click();
    await confirm(page, /Switch to Cleric/)
      .getByRole("button", { name: /^Pay 300/ })
      .click();
    await expect(
      page.getByRole("button", { name: /^Class · Cleric/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Class · Cleric/ }).click();
    await expect(sheet).toContainText(/Next switch in/);
    await expect(
      sheet.getByRole("button", { name: "Switch to Vanguard" }),
    ).toBeDisabled();
  });

  test("every fight card and the result screen show an enemy icon that fits the screen", async ({
    hero,
    page,
  }, info) => {
    await hero.start({ level: 80, classId: "striker" });
    await page.goto("/battle");
    for (const title of [
      "Weekly boss",
      "Endless tower",
      "Boss Tower",
      "Campaign",
    ]) {
      const icon = page
        .getByRole("region", { name: title })
        .locator("svg[data-enemy-icon]")
        .first();
      await expect(icon).toBeVisible();
      const box = await icon.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(32);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    }
    // Regular enemies and the endless tower have no art of their own yet: they show their kind's icon.
    await expect(
      page
        .getByRole("region", { name: "Endless tower" })
        .locator("svg[data-enemy-icon=tower-sentinel]"),
    ).toBeVisible();
    await shot(page, "battle-enemy-icons");
    await expectNoOverflow(page, "Battle hub with enemy icons", info);
    await expectTapTargets(
      page.locator("body"),
      "Battle hub with enemy icons",
      info,
    );

    await page
      .getByRole("region", { name: "Campaign" })
      .getByRole("button", { name: /^Fight/ })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Fight replay" })
        .locator("svg[data-enemy-icon]"),
    ).toBeVisible();
    await skipReplay(page);
    const result = page.getByRole("dialog", { name: "Fight result" });
    await expect(result.locator("svg[data-enemy-icon]").first()).toBeVisible();
    await expectNoOverflow(page, "Fight result with enemy icon", info);
    await expectTapTargets(result, "Fight result with enemy icon", info);
  });

  test("a fight plays its replay first: health bars follow the fight, speed changes, skip and watch again work", async ({
    hero,
    page,
  }, info) => {
    await hero.start({ level: 60, classId: "striker" });
    await page.goto("/battle");
    await page
      .getByRole("region", { name: "Campaign" })
      .getByRole("button", { name: /^Fight/ })
      .click();
    const replay = page.getByRole("dialog", { name: "Fight replay" });
    await expect(replay).toBeVisible();
    const hero_ = replay.getByRole("progressbar", { name: "You" });
    const foe = replay.getByRole("progressbar").nth(1);
    await expect(hero_).toBeVisible();
    await expect(foe).toBeVisible();
    // Every action shows an icon and a cooldown (the ultimate a charge), for you and for the enemy.
    for (const name of [
      /^Attack cooldown$/,
      /Strike cooldown$/,
      /Execution charge$/,
    ])
      await expect(
        replay.getByRole("progressbar", { name }).first(),
      ).toBeVisible();
    await expect(
      replay.getByRole("list", { name: "Your actions" }).locator("svg"),
    ).toHaveCount(3);
    await expect(
      replay
        .getByRole("list", { name: /'s actions$/ })
        .locator("svg")
        .first(),
    ).toBeVisible();
    await shot(page, "battle-replay");
    await expectNoOverflow(page, "Fight replay", info);
    await expectTapTargets(replay, "Fight replay", info);
    // Speed cycles 1x, 2x, 4x.
    const speed = replay.getByRole("button", { name: /^Speed/ });
    await expect(speed).toHaveText("1×");
    await speed.click();
    await expect(speed).toHaveText("2×");
    // Health only ever goes down for the enemy, and the replay ends on its own at the result.
    const result = page.getByRole("dialog", { name: "Fight result" });
    await speed.click();
    await expect(result).toBeVisible({ timeout: 30_000 });
    // Watching again works and ends back on the result.
    await result.getByRole("button", { name: "Watch replay" }).click();
    await expect(replay).toBeVisible();
    await skipReplay(page);
    await expect(result).toBeVisible();
  });
});
