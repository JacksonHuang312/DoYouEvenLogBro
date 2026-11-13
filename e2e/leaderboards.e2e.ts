import { expect, test } from "./fixtures";
import { expectNoOverflow, expectTapTargets, shot } from "./helpers";
import { seedRival } from "./seed";

/*
 * Friend leaderboards (GAME_DESIGN.md 13.27) at 390px against the emulators: the hero, a rival they
 * follow, and the numbers the server writes when the hero fights.
 */

/** The fight week now, as the page works it out (Sunday 04:00 local): close enough for a seed at any hour but that one. */
const thisWeek = () => {
  const d = new Date(Date.now() - 4 * 3_600_000);
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("Leaderboards", () => {
  test("you and the people you follow, ranked on each board; a fight puts your week's numbers on it", async ({ hero, page }, info) => {
    await hero.start({ level: 60, classId: "striker" });
    await seedRival({ power: 321.4, level: 61, classId: "vanguard", week: { id: thisWeek(), dealt: 5, absorbed: 900, healed: 10, fights: 2 } });

    await page.goto("/train");
    await page.getByRole("button", { name: /^Menu/ }).click();
    await page.getByRole("menuitem", { name: "Leaderboards" }).click();
    await expect(page.getByRole("heading", { name: "Leaderboards" })).toBeVisible();
    await expect(page.getByText("You and 1 person you follow")).toBeVisible();

    const rows = page.getByRole("tabpanel").getByRole("listitem");
    // Power: the rival has a number; the hero has had no counted workout since boards shipped.
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("@rival");
    await expect(rows.nth(0)).toContainText("321");
    await expect(rows.nth(0)).toContainText("Level 61 · Vanguard");
    await expect(rows.nth(1)).toContainText("@hero (you)");
    await expect(rows.nth(1)).toContainText("–");
    await shot(page, "leaderboards-power");
    await expectNoOverflow(page, "Leaderboards", info);
    await expectTapTargets(page.locator("body"), "Leaderboards", info);

    // This week's boards: nothing for the hero yet.
    await page.getByRole("tab", { name: "Absorbed" }).click();
    await expect(rows.nth(0)).toContainText("900");
    await expect(page.getByRole("tabpanel")).toContainText("Resets Sunday at 4 AM");

    // A Campaign win: the server adds the fight to the hero's week.
    const fight = await hero.api("/api/fight", { mode: "campaign", requestId: crypto.randomUUID() });
    expect(fight.status).toBe(200);
    await page.reload();
    await page.getByRole("tab", { name: "Damage" }).click();
    // The hero dealt far more than the rival's 5, so they lead.
    await expect(rows.nth(0)).toContainText("@hero (you)");
    await expect(rows.nth(0)).toContainText("Level 60 · Striker");
    await expect(rows.nth(0)).not.toContainText("–");
    await expect(rows.nth(1)).toContainText("@rival");
    await shot(page, "leaderboards-damage");
    await expectNoOverflow(page, "Leaderboards after a fight", info);

    // A row opens that player's profile.
    await rows.nth(1).getByRole("link").click();
    await expect(page).toHaveURL(/\/u\/e2e-rival$/);
  });

  test("a private account that hasn't accepted you shows a dash, never its numbers", async ({ hero, page }) => {
    await hero.start({ level: 60, classId: "striker" });
    await seedRival({ power: 999, level: 99 }, { isPrivate: true, follows: false });
    await page.goto("/leaderboards");
    const rival = page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: "@rival" });
    await expect(rival).toBeVisible();
    await expect(rival).toContainText("–");
    await expect(rival).not.toContainText("999");
    await expect(page.getByRole("tabpanel")).toContainText("private account that hasn't accepted your follow");
  });
});
