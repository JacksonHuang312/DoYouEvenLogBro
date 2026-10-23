import { expect, test as base, type Page } from "@playwright/test";
import { HERO, resetHero, type SeedOptions } from "./seed";

declare global {
  interface Window {
    /** Set by src/lib/firebase.ts when NEXT_PUBLIC_FIREBASE_EMULATOR=1. */
    __emulatorSignIn?: (email: string, password: string) => Promise<{ user: { getIdToken(): Promise<string> } }>;
  }
}

export type HeroTab = "Stats" | "Gear" | "Shop" | "Titles";

export interface Hero {
  page: Page;
  uid: string;
  /** Reseeds the test user, then signs in and opens /hero. Call once at the start of a test. */
  start(options?: SeedOptions, tab?: HeroTab): Promise<void>;
  openTab(tab: HeroTab): Promise<void>;
  /** POSTs to a game route as the signed-in user. */
  api(path: string, body: Record<string, unknown>): Promise<{ status: number; json: { error?: string } & Record<string, unknown> }>;
}

export const test = base.extend<{ hero: Hero }>({
  hero: async ({ page }, provide) => {
    let token = "";
    const hero: Hero = {
      page,
      uid: HERO.uid,
      async start(options, tab = "Stats") {
        await resetHero(options);
        // Any page loads Firebase and installs the emulator sign-in hook.
        await page.goto("/");
        await page.waitForFunction(() => typeof window.__emulatorSignIn === "function");
        token = await page.evaluate(
          async ([email, password]) => (await window.__emulatorSignIn!(email, password)).user.getIdToken(),
          [HERO.email, HERO.password],
        );
        await page.goto("/hero");
        await expect(page.getByRole("tablist", { name: "Hero sections" })).toBeVisible();
        await hero.openTab(tab);
      },
      async openTab(tab) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
      },
      async api(path, body) {
        const res = await page.request.post(path, { data: body, headers: { Authorization: `Bearer ${token}` } });
        return { status: res.status(), json: (await res.json()) as { error?: string } & Record<string, unknown> };
      },
    };
    await provide(hero);
  },
});

export { expect };
