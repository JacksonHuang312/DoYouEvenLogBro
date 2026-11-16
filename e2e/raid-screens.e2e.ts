import { expect, test } from "./fixtures";
import { expectNoOverflow, expectTapTargets, shot } from "./helpers";
import { rivalApi } from "./rival";
import { HERO, RIVAL, seedRival } from "./seed";

/*
 * The raid screens (GAME_DESIGN.md 13.32) at 390px against the emulators, with two players: the
 * hero in the browser and the rival through the server routes.
 */

const SEED = { level: 62, classId: "vanguard", statLevel: 60 } as const;

test.describe("Raid screens", () => {
  test("the leader makes a party, invites a mutual follow, starts once they join, and sees the result", async ({ hero, page }, info) => {
    await hero.start({ level: 60, classId: "striker", statLevel: 60 });
    await seedRival({}, { mutual: true, seed: SEED });
    const rival = await rivalApi(page.request);

    await page.goto("/battle");
    const card = page.getByRole("region", { name: "Raid", exact: true });
    await expect(card.getByRole("heading", { name: "Raid" })).toBeVisible();
    await expect(card).toContainText("2 to 4 players who follow each other, within 25 levels");
    await expect(card).toContainText("One raid a week, win or lose");
    await card.scrollIntoViewIfNeeded();
    await shot(page, "raid-card");
    await expectNoOverflow(page, "Raid card", info);
    await expectTapTargets(card, "Raid card", info);

    // Make a party: the app's own tier list, the highest tier picked.
    await card.getByRole("button", { name: "Make a party" }).click();
    const sheet = page.getByRole("dialog", { name: "Raid party" });
    await expect(sheet.getByRole("radio").first()).toBeVisible();
    await expect(sheet.locator("select")).toHaveCount(0);
    await sheet.getByRole("radio", { name: /^Tier 1 / }).click();
    await expect(sheet.getByRole("radio", { name: /^Tier 1 / })).toHaveAttribute("aria-checked", "true");
    await expectTapTargets(sheet, "Make a party", info);
    await sheet.getByRole("button", { name: /^Make party/ }).click();

    // The lobby: the leader alone, the rival offered, Start off until someone joins.
    const party = sheet.getByRole("list", { name: "Party" });
    await expect(party.getByRole("listitem")).toHaveCount(1);
    await expect(party).toContainText("@hero (you)");
    await expect(party).toContainText("Leader");
    await expect(sheet.getByRole("button", { name: "Start raid" })).toBeDisabled();
    await expect(sheet).toContainText("A raid needs at least 2 players");
    await sheet.getByRole("button", { name: "Invite rival" }).click();
    await expect(party.getByRole("listitem")).toHaveCount(2);
    await expect(party.getByRole("listitem").nth(1)).toContainText("Invited");
    await expect(sheet).toContainText("Everyone you could ask is already here.");
    await shot(page, "raid-lobby", { full: false });
    await expectNoOverflow(page, "Raid lobby", info);
    await expectTapTargets(sheet, "Raid lobby", info);

    // The rival joins on their own device: the lobby follows live.
    const raidId = (await hero.api("/api/raid", { action: "create", tier: 1 })).json.raidId as string;
    expect((await rival("/api/raid", { action: "join", raidId })).status).toBe(200);
    await expect(party.getByRole("listitem").nth(1)).toContainText("Joined");
    await expect(sheet.getByRole("button", { name: "Start raid" })).toBeEnabled();

    await sheet.getByRole("button", { name: "Start raid" }).click();
    await page.getByRole("dialog", { name: "Start the raid?" }).getByRole("button", { name: "Start raid" }).click();

    // The result: both members' numbers and pay, the log, at 390px.
    const result = page.getByRole("dialog", { name: "Raid result" });
    await expect(result.getByRole("heading")).toHaveText(/Victory|Defeat/);
    await expect(sheet).toBeHidden();
    const rows = result.getByRole("region", { name: "Party" }).getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("@hero (you)");
    await expect(rows.nth(0)).toContainText("Striker");
    await expect(rows.nth(1)).toContainText("@rival");
    await expect(rows.nth(1)).toContainText("Vanguard");
    for (const label of ["Damage", "Absorbed", "Healing"]) await expect(rows.nth(0)).toContainText(label);
    await result.getByText(/^Log \(\d+ events\)$/).click();
    await expect(result.getByRole("region", { name: "Raid log" }).getByRole("listitem").first()).toBeVisible();
    await shot(page, "raid-result");
    await expectNoOverflow(page, "Raid result", info);
    await expectTapTargets(result, "Raid result", info);
    await result.getByRole("button", { name: "Done" }).click();
    await expect(result).toBeHidden();

    // Back on the card: this week's raid is used, and the last one can be opened again.
    await expect(card).toContainText("You've raided this week");
    await expect(card.getByRole("button", { name: "Make a party" })).toHaveCount(0);
    await card.getByRole("button", { name: /^Last raid/ }).click();
    await expect(result).toBeVisible();
    await result.getByRole("button", { name: "Done" }).click();
  });

  test("an invited player sees the invitation, joins, can't start, and finds the result once the leader has", async ({ hero, page }, info) => {
    await hero.start({ level: 60, classId: "striker", statLevel: 60 });
    await seedRival({}, { mutual: true, seed: SEED });
    const rival = await rivalApi(page.request);
    const made = await rival("/api/raid", { action: "create", tier: 1, invite: [HERO.uid] });
    expect(made.status).toBe(200);
    const raidId = made.json.raidId as string;

    await page.goto("/battle");
    const card = page.getByRole("region", { name: "Raid", exact: true });
    const invitations = card.getByRole("list", { name: "Raid invitations" });
    await expect(invitations).toContainText("@rival asks you to raid");
    await expect(invitations).toContainText("Tier 1 · 1 joined");
    await card.scrollIntoViewIfNeeded();
    await shot(page, "raid-invitation");
    await expectNoOverflow(page, "Raid invitation", info);
    await expectTapTargets(card, "Raid invitation", info);
    await invitations.getByRole("button", { name: "Join" }).click();

    await expect(card).toContainText("You're in a party · tier 1 · 2 joined");
    await expect(invitations).toHaveCount(0);
    await card.getByRole("button", { name: "Open party" }).click();
    const sheet = page.getByRole("dialog", { name: "Raid party" });
    await expect(sheet.getByRole("list", { name: "Party" }).getByRole("listitem")).toHaveCount(2);
    await expect(sheet.getByRole("button", { name: "Start raid" })).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: /^Invite / })).toHaveCount(0);
    await expect(sheet).toContainText("The leader starts the raid");
    await expect(sheet.getByRole("button", { name: "Leave party" })).toBeVisible();
    await sheet.getByRole("button", { name: "Close" }).click();

    // The leader starts elsewhere: the card turns into the last raid, with this player's row marked.
    expect((await rival("/api/raid", { action: "start", raidId })).status).toBe(200);
    await card.getByRole("button", { name: /^Last raid/ }).click();
    const result = page.getByRole("dialog", { name: "Raid result" });
    const rows = result.getByRole("region", { name: "Party" }).getByRole("listitem");
    await expect(rows.nth(0)).toContainText("@rival");
    await expect(rows.nth(1)).toContainText("@hero (you)");
    await result.getByRole("button", { name: "Done" }).click();
    await expect(card).toContainText("You've raided this week");
  });

  test("declining an invitation removes it, and a player under level 20 is told raids are locked", async ({ hero, page }) => {
    await hero.start({ level: 60, classId: "striker", statLevel: 60 });
    await seedRival({}, { mutual: true, seed: SEED });
    const rival = await rivalApi(page.request);
    await rival("/api/raid", { action: "create", tier: 1, invite: [HERO.uid] });
    await page.goto("/battle");
    const card = page.getByRole("region", { name: "Raid", exact: true });
    await card.getByRole("list", { name: "Raid invitations" }).getByRole("button", { name: "Decline" }).click();
    await expect(card.getByRole("list", { name: "Raid invitations" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Make a party" })).toBeVisible();

    await hero.start({ level: 12, classId: "striker", statLevel: 60 });
    await page.goto("/battle");
    await expect(page.getByRole("region", { name: "Raid", exact: true })).toContainText("Raids open at level 20");
    await expect(page.getByRole("region", { name: "Raid", exact: true }).getByRole("button", { name: "Make a party" })).toHaveCount(0);
    expect(RIVAL.uid).toBe("e2e-rival");
  });
});
