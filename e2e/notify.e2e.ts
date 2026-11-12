import { expect, test } from "./fixtures";
import { expectNoOverflow, shot } from "./helpers";

/*
 * Push notifications (GAME_DESIGN.md 13.26) against the emulators: the Settings switches and the
 * daily job. There is no push service here, so the device token is a made-up one and the job
 * "delivers" without sending anything; real delivery to a phone can't be checked in this suite.
 */

type Report = { checked: number; sent: Record<string, number>; removed: number; failed: number };

test.describe("Notifications", () => {
  test("Settings turns them on for this device, the daily job sends what is due once, and each message has its own switch", async ({
    hero,
    page,
    context,
  }, info) => {
    await context.grantPermissions(["notifications"]);
    await hero.start({ level: 60, classId: "striker" });
    // The notify doc outlives a reseed: start from nothing.
    await hero.api("/api/notify", { action: "disable", token: null });
    await hero.api("/api/notify", { action: "prefs", prefs: { weeklyFight: true, levelUp: true } });
    const job = async () => (await (await page.request.get("/api/cron/notify")).json()) as Report;
    expect(await job()).toMatchObject({ checked: 0, sent: {} });

    await page.goto("/settings");
    const device = page.getByRole("checkbox", { name: /Notifications on this device/ });
    const weekly = page.getByRole("checkbox", { name: /Weekly fight is ready/ });
    const level = page.getByRole("checkbox", { name: /One workout from a level/ });
    await expect(device).not.toBeChecked();
    await expect(weekly).toBeDisabled();
    // click(), not check(): the box follows the server's answer, a moment after the tap.
    await device.click();
    await expect(device).toBeChecked();
    await expect(weekly).toBeEnabled();
    await expect(weekly).toBeChecked();
    await expect(level).toBeChecked();
    await shot(page, "settings-notifications");
    await expectNoOverflow(page, "Settings notifications", info);
    for (const box of [device, weekly, level]) {
      const row = await page.locator("label").filter({ has: box }).boundingBox();
      expect(row!.height).toBeGreaterThanOrEqual(43.5);
    }

    // A class and an unused weekly fight: that message is due. It is sent once, not again tomorrow.
    expect(await job()).toMatchObject({ checked: 1, sent: { weeklyFight: 1 }, failed: 0 });
    expect(await job()).toMatchObject({ checked: 1, sent: {} });

    // After the next weekly fight day it would be due again; with its switch off it never is.
    await weekly.click();
    await expect(weekly).not.toBeChecked();
    await page.reload();
    await expect(page.getByRole("checkbox", { name: /Weekly fight is ready/ })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Notifications on this device/ })).toBeChecked();

    // Off again: the job no longer looks at this player.
    await page.getByRole("checkbox", { name: /Notifications on this device/ }).click();
    await expect(page.getByRole("checkbox", { name: /Notifications on this device/ })).not.toBeChecked();
    expect(await job()).toMatchObject({ checked: 0 });
  });

  test("a dead device is dropped by the job, and bad requests are refused", async ({ hero, page }) => {
    await hero.start({ level: 60, classId: "striker" });
    await hero.api("/api/notify", { action: "disable", token: null });
    // The switches belong to the account and outlive a reseed: put them back on.
    await hero.api("/api/notify", { action: "prefs", prefs: { weeklyFight: true, levelUp: true } });
    const on = await hero.api("/api/notify", { action: "enable", token: "dead-device-token" });
    expect(on.json).toMatchObject({ enabled: true, devices: 1 });
    // Registering the same device again is still one device.
    expect((await hero.api("/api/notify", { action: "enable", token: "dead-device-token" })).json).toMatchObject({ devices: 1 });

    const first = (await (await page.request.get("/api/cron/notify")).json()) as Report;
    expect(first).toMatchObject({ checked: 1, sent: {}, removed: 1 });
    const second = (await (await page.request.get("/api/cron/notify")).json()) as Report;
    expect(second).toMatchObject({ checked: 0 });

    expect((await hero.api("/api/notify", { action: "enable", token: "no" })).status).toBe(400);
    expect((await hero.api("/api/notify", { action: "prefs", prefs: { towerOpen: true } })).status).toBe(400);
    expect((await page.request.post("/api/notify", { data: { action: "disable", token: null } })).status()).toBe(401);
  });
});
