# End-to-end tests

Playwright drives the real app in Chrome at a 390px phone viewport. Google sign-in can't be automated,
so the suite never uses it: it runs against the **Firebase emulators** with a seeded test user.

## Safety

- Nothing here talks to the real `doyouevenlogbro` project. The Next.js dev server and the tests
  are started with `NEXT_PUBLIC_FIREBASE_EMULATOR=1` and the project id `demo-dyelb`.
- `seed.ts` refuses to run unless the Firestore and Auth emulator hosts are set and the project
  starts with `demo-`.
- No keys or `.env` values are used or needed. The one test user (`hero@test.dev`, password
  `password123`) exists only inside the emulator.
- `e2e/` is outside `src/`, excluded from the main `tsconfig.json`, and ignored by Vitest, so it is
  not part of `next build`. The dev server writes to `.next-e2e/` (gitignored), so it can run next
  to your own `npm run dev`.

## Run

Needs Java (for the Firestore emulator) and Chrome. Ports 8080, 9099 and 3100 must be free. `npm run e2e` first stops a leftover e2e emulator from an earlier run (only one that mentions `demo-dyelb`); `npm run e2e:cleanup` does just that.

```bash
npm run e2e          # starts the emulators, a dev server, runs everything headless
npm run e2e:headed   # same, with a visible browser
```

Output goes to `e2e/.output/` (gitignored): `screens/` has the 390px screenshots, `report/` the HTML
report, `results/` the traces of failed tests. Open a report with `npx playwright show-report e2e/.output/report`.

To click around by hand as the test user: `npm run emulators`, then `npm run e2e:seed`, then
`NEXT_PUBLIC_FIREBASE_EMULATOR=1 npm run dev` and sign in through the emulator hook
(`window.__emulatorSignIn("hero@test.dev", "password123")` in the browser console).

## How it works

- `playwright.config.ts`: 390x844 mobile viewport, one worker, starts `next dev` on port 3100 with
  the emulator env. `E2E_CHANNEL=msedge` switches the browser to Edge.
- `seed.ts`: `resetHero()` wipes and recreates the test user (profile, game state at level 30 with
  5,000 coins and 300 scrap, finished calibration, strength in every muscle, and a known set of
  gear: two identical Silver Loops, a Gold Seal, a Copper Band, a named Sunforged Ring and a
  Steelguard Helmet). Every test starts with it, so tests don't depend on each other.
- `fixtures.ts`: the `hero` fixture seeds, signs in through the `window.__emulatorSignIn` hook
  (installed by `src/lib/firebase.ts` only when emulators are on), opens `/hero` and gives tests
  `openTab()` and `api()` (a signed-in call to a game route).
- `helpers.ts`: `shot()` for screenshots, and soft checks for horizontal overflow and tap targets
  under 44px. Those record an annotation and fail the test at the end, so one run lists everything.

## Specs

| File | Covers |
| --- | --- |
| `gear.e2e.ts` | Gear tab layout, stacking (`×N`), equip/unequip across ring 1 and ring 2, same item in two positions refused, sell/salvage one copy of a stack, named gear, level locks |
| `shop.e2e.ts` | Offer cards, buy, double-tap protection, reroll (100 then 200), no-coins state |
| `titles.e2e.ts` | Eight achievements, equip/unequip, buying slot 2 |
| `offline.e2e.ts` | Gear, Shop and Titles with the network off: buttons disabled, offline notes shown, back online re-enables |

## Adding a flow

Start the test with `await hero.start({ coins: 0, gear: ["loopA"] }, "Shop")`. Add items to `GEAR`
in `seed.ts` if you need another base item. Prefer role and text locators over CSS classes.
