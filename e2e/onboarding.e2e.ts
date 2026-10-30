import { expect, test } from "@playwright/test";
import { expectNoOverflow, expectTapTargets, shot } from "./helpers";
import { HERO, resetSignedUpHero } from "./seed";

/*
 * Sign-up (GAME_DESIGN.md 13.14): a new account picks its username, unit and class together. The
 * class pick is free, and it is saved with the profile.
 */

test("a new account picks a class while setting up its profile", async ({ page }, info) => {
  await resetSignedUpHero();
  await page.goto("/");
  await page.waitForFunction(() => typeof (window as unknown as { __emulatorSignIn?: unknown }).__emulatorSignIn === "function");
  await page.evaluate(
    async ([email, password]) =>
      (window as unknown as { __emulatorSignIn: (e: string, p: string) => Promise<unknown> }).__emulatorSignIn(email, password),
    [HERO.email, HERO.password],
  );
  // A signed-in account without a profile is sent to sign-up by the home page itself.
  await page.waitForURL("**/onboarding");

  const next = page.getByRole("button", { name: "Continue" });
  await page.getByLabel("Username").fill("newhero");
  // The class is part of the form: Continue waits for it.
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: /^Cleric/ }).click();
  await expect(page.getByRole("button", { name: /^Cleric/ })).toHaveAttribute("aria-pressed", "true");
  await shot(page, "onboarding-class");
  await expectNoOverflow(page, "Onboarding", info);
  // Only the new class buttons are held to 44px; the older form above them predates that rule.
  await expectTapTargets(page.getByRole("group", { name: "Class" }), "Onboarding class pick", info);
  await expect(next).toBeEnabled();
  await next.click();

  await page.waitForURL("**/train");
  // The pick was saved: the Battle tab opens on the fight cards, not the picker.
  await page.goto("/battle");
  await expect(page.getByText(/Cleric · Energy/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick your class" })).toHaveCount(0);
});
