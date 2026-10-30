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

For a playable account with real-looking stats and no logged workouts, `npm run seed:har` (emulators running) creates `har@test.dev` / `password123` at level 40 with about 40 in every stat, coins, scrap and gear and no class yet (`-- --level 60 --stat 60 --class striker` to change it). It refuses anything but the local emulators, and the data is gone when they stop, so run it again after a restart.

To click around by hand as the test user: `npm run emulators`, then `npm run e2e:seed`, then
`NEXT_PUBLIC_FIREBASE_EMULATOR=1 npm run dev` and sign in through the emulator hook
(`window.__emulatorSignIn("hero@test.dev", "password123")` in the browser console).

## How it works

- `playwright.config.ts`: 390x844 mobile viewport, one worker, starts `next dev` on port 3100 with
  the emulator env. `E2E_CHANNEL=msedge` switches the browser to Edge.
- `seed.ts`: `resetHero()` wipes and recreates the test user (profile, game state at level 30 with
  5,000 coins and 300 scrap, about 30 in every stat, 6 claims (First Steps), and a known set of
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
| `routines.e2e.ts` | Routine editor rep range: empty by default, half-typed/reversed/out-of-bounds refused, step in the user's unit saved in kg, reopening, clearing removes every field |
| `workout-targets.e2e.ts` | Workout screen target and hint (add weight, aim for the top, lighter), changing the range mid-workout saves to the routine, clearing, logging a set still works |
| `quests.e2e.ts` | Quests screen: rerolls left instead of prices, the pause and injury text behind an info button |
| `effort.e2e.ts` | Set picker from the set number: RPE and type apply at once, clearing, Settings RPE/RIR, RIR on the workout and a saved workout |
| `stats.e2e.ts` | Stats tab after the stat rework: layout and breakdown, the rust line, a claim that beats the last session (1.25 points a set), recompute, and `backfill --rework` |

## Adding a flow

Start the test with `await hero.start({ coins: 0, gear: ["loopA"] }, "Shop")`. Add items to `GEAR`
in `seed.ts` if you need another base item. Prefer role and text locators over CSS classes.

## 390px checklist (Hero: Gear, Shop, Titles)

Last checked after the e2e suite was built: automated checks on every screen, plus a look at the screenshots in `e2e/.output/screens/`.

- [x] No sideways scrolling and nothing past the right edge (checked by the tests on Gear, ring sheet, sell confirm, Shop, buy confirm, Titles and all offline views)
- [x] Buttons and tabs are at least 44px tall (checked by the tests on Gear, ring sheet, Shop and Titles)
- [x] Sheets and confirm dialogs fit the width, with Cancel and the action side by side
- [x] Long names wrap instead of clipping (Steelguard Tassets, Scrapper Brigandine, the Legendary upgrade line)
- [x] Offline notes show in orange on all three tabs and every action button is greyed out and still readable
- [x] Rarity colors, flat line-art icons, no glow or gradients (7.1)
- [x] Level locks, "Named gear can't be sold", and the stack "×2" text show on the cards
- [ ] Not checked: widths below 390px (for example 360px), a real phone, the iOS safe-area inset, the on-screen keyboard, landscape
- [ ] Not checked: how the fixed bottom nav looks while scrolling a long page (the full-page screenshots draw it mid-page, which is only how they are captured)
- Dev only: the round "N" badge at the bottom left is Next's dev indicator, not part of the app

