# DoYouEvenLogBro — RPG Revamp Design

This is the source of truth for turning DoYouEvenLogBro into an RPG. Read it fully before writing code.
All numbers marked **(tunable)** are starting values: they live in the game config file, never hard-coded in logic.

---

## 1. Principles

1. **Logging comes first.** The existing workout tracker (routines, logging, rest timer, history, PRs, social) must keep working exactly as it does now. The RPG is a layer on top of it.
2. **Store facts, compute everything else.** Persist only raw facts (workouts, when each sub-muscle was last trained, claims, owned items, bodyweight entries). Stats, power, combat attributes and levels are computed from facts + config, so rebalancing never needs a data migration.
3. **The server grants all rewards.** Coins, XP, stats, loot and battle results are computed in Next.js API routes using `firebase-admin`. Clients can never write game state. (Reason: correctness and no double payouts now; anti-cheat once trading exists.)
4. **Config-driven.** Muscle weights, multipliers, prices, drop rates, payouts, and level requirements live in TypeScript config files in the repo (e.g. `src/lib/game/config.ts`), not Firestore.
5. **Pure, tested game logic.** All formulas are pure functions in `src/lib/game/` with Vitest unit tests.
6. **Friends-only competition.** There is no global leaderboard. Anti-cheat stays light; correctness and idempotency do not.

---

## 2. Stats

### 2.1 Six stats, built from sub-muscles

Every exercise maps to exactly one sub-muscle (its existing `muscle` field in `src/data/exercises.json`). Each sub-muscle has its own score (0–100). A stat is the **weighted average** of its sub-muscle scores, so one strong muscle can't carry a weak group.

| Stat | Sub-muscle weights (sum to 100%) **(tunable)** |
| --- | --- |
| Chest | chest 100% |
| Back | lats 40% · middle back 40% · lower back 20% |
| Shoulders | shoulders 75% · traps 20% · neck 5% |
| Arms | triceps 45% · biceps 40% · forearms 15% |
| Legs | quadriceps 35% · hamstrings 30% · calves 15% · glutes 10% · adductors 5% · abductors 5% |
| Core | abdominals 100% |

Example: quads 90, all other leg muscles 20 → Legs = 0.35×90 + 0.65×20 = 44.5.

- Exercises in the `cardio` category are accessory work and do **not** affect stats.
- Custom exercises must pick their muscle from these 17 values (dropdown grouped by stat). Update `firestore.rules` to only allow these values.

### 2.2 Sub-muscle score

Combines strength and frequency **(tunable split, start 80% strength / 20% frequency)**:
- **Strength:** best estimated 1RM from working sets (warm-ups excluded), using Epley: `1RM = weight × (1 + reps / 30)`, relative to the user's bodyweight, normalized against strength standards by sex/age into 0–100. **Reps above 12 are counted as 12 in the estimate (tunable)** so light high-rep sets can't inflate a 1RM. Stats have **no cap**: the standards table extrapolates past 100 and the radar axis scales up (see section 12).
- **Bodyweight exercises** (`weightKg == null`): use bodyweight × an exercise factor, or a reps-based score.
- **Frequency:** how many of the last 4 weeks the sub-muscle was trained.

### 2.3 1RM bonus

If a set's actual weight beats the user's calculated 1RM, the stat gets a small bonus shown separately, e.g. `Chest 62 (+2)`. The bonus is capped at **5% of the stat (tunable)** so maxing out is never worth more than consistent training. Users who never test 1RMs simply get no bonus.

### 2.4 Decay

A sub-muscle not trained for **7 days** starts decaying slowly **(tunable rate)**. Decay is computed lazily when stats are read, from `lastTrained`. No scheduled job is needed.

### 2.5 Power

`Power = Σ(stat × stat multiplier) + gear bonuses + title bonuses`

| Stat | Power multiplier **(tunable)** |
| --- | --- |
| Chest, Back, Shoulders, Arms, Legs | 1.0× |
| Core | 0.5× |

Core stays on the same 0–100 radar scale; it just counts less toward power, combat HP, boss minimums and quest targeting.

### 2.6 Starting stats and bodyweight

- Onboarding asks age, bodyweight, sex. Starting stats = population averages for those.
- **Calibration period:** first 2 weeks or 6 workouts **(tunable)**. The radar shows "Calibrating…" and real numbers replace averages afterward, so beginners never see stats "drop" on day one.
- Existing users are **backfilled** from their workout history by a script.
- Monthly weigh-in prompt. If skipped, keep using the last weight.

### 2.7 Comparisons

The radar chart overlays a past period (1 week / 1 month / 1 year). Store weekly stat snapshots (written at claim time or by a weekly cron).

---

## 3. Progression and economy

### 3.1 What counts as a workout

At least **4 working sets** (warm-ups excluded).

### 3.2 Coins

- Base coins per workout + bonus for doing a **scheduled** workout on its scheduled day.
- Off-day curve: full bonus on the day, reduced the further away **(tunable, start: −20% per day, 0 bonus beyond 3 days)**.
- Backdated workouts are allowed and paid through the same curve, so a workout logged days late pays little.
- **Daily coin cap (tunable).**
- **Idempotent:** one claim per workout ID. Coins are locked at claim time; editing a workout later can update stats but never re-pays coins.

### 3.3 XP and levels

- XP comes mostly from stat gains, plus a little from completing workouts and quests.
- Workout-completion XP pays at most once every **12 hours (tunable)**, matching the 2-workouts-a-day coin cap. Stat-gain XP is unaffected.
- XP per level is flat (no growth curve); real strength gains slow down naturally. Levels are uncapped.

### 3.4 Weekly quests

- System-generated, diverse, and aimed at the user's weakest sub-muscles (e.g. "Arms is your lowest stat: log 12 working sets of arms"). Core is targeted less often.
- Generated lazily the first time the user opens the app each week.

### 3.5 Weekly reset

**Sunday 00:00** in the user's time zone: quests, weekly bosses and shop stock refresh. Bosses and shop are generated deterministically from the week number as a seed, so nothing has to be stored or scheduled.

### 3.6 Pause mode

Vacation pause freezes decay and the schedule. You pick a planned length of **at least 7 days (tunable max 4 weeks)**; it ends automatically. No battles or boss clears while paused.

**Injury flags** are separate from pause: the user marks up to 2 stats as injured (optional note and expected return). While flagged, quests skip that stat, its decay is frozen, and the boss minimum for it is waived. Flags auto-expire after 8 weeks unless renewed. The flag shows on the user's Hero for people who follow them (user can hide it).

---

## 4. Combat

- **Auto-resolve battles** (AFK Arena style): compare power and per-stat checks, roll outcome on the server, show a short result.
- **Combat attributes:** HP, ATK, DEF derived from the six stats, weighted by class.
- **Per-body-part minimums:** each boss checks minimum values on specific stats, so an untrained body part can't be brute-forced. Being under is allowed only if total power is higher by a margin **(tunable)**.
- **Gear contributes at most ~30% of total power (tunable)**, so nobody buys their way through.
- **4-hour cooldown** after a loss.

### 4.1 Content

- **Weekly bosses** at level tiers: more power unlocks higher tiers with better loot. Boss tier is locked at the start of the week; rewards only on the first clear each week.
- **Towers:** endless floors, increasingly hard, rewards only on first clear of each floor.

### 4.2 Classes

A class changes how stats convert into combat attributes, never which muscles count. Every class uses all six stats. Switching costs coins, once per week.

| Class | Focus | Leaderboard stat |
| --- | --- | --- |
| Vanguard (tank) | Back, Legs, Core → HP, DEF | Damage absorbed |
| Striker (damage) | Chest, Shoulders, Arms → ATK | Damage dealt |
| Cleric (healer) | Consistency (scheduled-workout streak) + Core → healing | Healing done |

### 4.3 Party raids

- Minimum level and power **per member** to enter a raid tier.
- Party members within ±10 levels **(tunable)**.
- **Loot is rolled at each player's own level**, not the boss's.
- Minimum contribution (~15% of party power, **tunable**) to get loot; otherwise coins only.
- Optional **mentor mode:** higher levels join lower raids with power scaled down; they get coins and a "Mentor" title, no loot.

---

## 5. Items

- **Slots:** five armor slots (helmet, chestplate, gloves, leggings, boots) and four accessory slots worn in six positions: ring ×2, necklace, belt, charm ×2. Accessories are never part of a set.
- **Rarity ladder:** Common → Uncommon → Rare → Epic → Legendary → Mythic.
- **Named vs unnamed:** items that *start* at Legendary or Mythic are **named**. Everything that starts below (Common–Epic) is **unnamed**.
- **Where sets exist:** Common and Uncommon have **no sets**; they are loose items, several per slot. Sets exist only at **Rare, Epic and Legendary** (5 armor pieces each). Rare and Epic sets are unnamed, Legendary sets are named. **Mythic has no sets**: each Mythic is a standalone named item with its own unique effect (behavior in Phase 5).
- **Focus:** every item splits its power across HP / ATK / DEF (for example 70% HP / 30% DEF). All pieces of a set share the set's focus; a Mythic is 100% one attribute.
- **Unnamed gear** can climb all the way to Legendary (Epic → Legendary), but stops there. It never reaches Mythic.
- **Named gear** starts at Legendary or Mythic. Native Legendary can climb to Mythic (requires boss-only materials).
- **Ascended vs native:** an Epic upgraded to Legendary ("ascended") is always worse than a native Legendary: about **85%** of native stats at +0 and about **92%** at +2 (**tunable**), so a maxed ascended item still loses to a fresh native one. Only named gear gets unique set bonuses and abilities.
- **Upgrades:** +0 → +1 → +2 → next rarity at +0. Costs coins + salvage. **Upgrades never fail.**
- **Level requirement to equip** by rarity **(tunable: Epic 8, Legendary 15, Mythic 25)**.
- **Sets:** bonuses at 3 and 5 pieces. The bonus applies only to the power of that set's own equipped pieces, and only your best equipped set counts.
- **Shop:** weekly rotating stock, deliberately pricey. Sells **Common through Epic only**, armor and accessories (about 30% of offers are accessories). Legendary and Mythic are never sold.
- **Boss loot:** the only source of Legendary and Mythic. Pity system: guaranteed Legendary after X boss kills without one.
- **Coin sinks:** salvage/sell duplicates, upgrades, shop rerolls, class switches, title slots, cosmetics.

### 5.1 Titles

Earned through achievements (e.g. +10% HP for not skipping a scheduled workout for a month). One title slot by default; buy extra slots with coins up to **3 stacked**. Each title gives a small bonus (~2–5%).

---

## 6. Social

- **Leaderboards are friends-only:** you plus everyone you follow, read from `publicStats/{uid}` in batches of 30 (Firestore `in` limit), respecting private accounts.
- Weekly boards: total power, progression (stat growth this month), damage dealt, healing done, damage absorbed, scheduled-workout streak.
- **Trading:** later, not in this revamp. When added: server-only two-step offer/accept in one transaction; level 10+, 14+ day accounts, mutual follows for 7+ days; boss loot untradeable; coin tax; weekly limit; no one-sided trades.

---

## 7. UI

### 7.1 Visual direction

Flat, restrained, and specific — explicitly **not** the default AI look.
- Dark flat grounds (`#101113`, surfaces `#17181b`, hairlines `#26282c`), text `#ece8df`, muted `#8d8a83`.
- **One accent** (`#5b9bff`) for level, current stats and the active tab. Other color only where it carries meaning: rarity, pass/fail, deltas.
- Fonts: **Barlow Condensed** (headings, uppercase) + **IBM Plex Mono** (everything else).
- **Avoid:** glow, gradients, glassmorphism, pulsing/looping animation, nested cards, eyebrow badges over every section, icon-tile grids, one-sided colored borders, vague copy.
- Rarity colors: Common `#9a978f`, Uncommon `#6fbf8c`, Rare `#5b9bff`, Epic `#a98bf0`, Legendary `#d9a441`, Mythic `#e0605f`.

### 7.2 Navigation

Bottom nav: **Train · Quests · [ + ] · Battle · Hero**

- **Train (home):** today's scheduled workout with Start button and coin note, week strip (done / late / today / planned), routines, last workout + history link, exercise library via search button.
- **Quests:** weekly quests + schedule calendar.
- **[ + ]:** start an empty workout or pick a routine.
- **Battle:** weekly boss, tower, raids.
- **Hero:** switcher Stats · Gear · Shop · Titles. Profile, settings, friends and leaderboards behind the avatar.

### 7.3 Key screens

- **Active workout:** full screen, no nav; minimize arrow, timer, Finish; sets table (set, previous, weight, reps, check), PR trophy, remaining exercises, rest timer pinned at bottom. While minimized, a "Workout in progress" bar sits above the nav.
- **Rewards (after Finish):** coin breakdown (base + scheduled bonus vs daily cap), XP added to level bar, stat changes, 1RM bonus line, quest progress. Shows "Syncing — rewards when you're back online" if offline.
- **Hero · Stats:** radar chart (six axes: Chest, Shoulders, Core, Legs, Arms, Back), dashed overlay for the comparison period, dotted overlay for the current boss minimum, 1W/1M/1Y toggle, stat table with value, `(+X)` bonus and change. Tapping a stat shows its sub-muscle breakdown.

---

## 8. Architecture

### 8.1 Server

- Add `firebase-admin`; service-account credentials in Vercel env vars (never committed).
- One helper verifies the Firebase ID token on every API route.
- Validate request bodies with **Zod**.
- Use Firestore transactions for anything that changes game state.

### 8.2 Claim flow (offline-friendly)

1. `finish()` keeps saving the workout offline-first exactly as today (`WorkoutProvider.tsx`).
2. When online, the client calls `POST /api/claim { workoutId }`.
3. The server reads the saved workout, checks it hasn't been claimed, computes coins/XP/stat facts/quest progress with `src/lib/game/`, writes everything plus a claim record in one transaction, and returns the numbers for the Rewards screen.
4. A second claim for the same workout ID returns the original result and pays nothing.

### 8.3 Data model additions (server-written only)

| Path | Contents |
| --- | --- |
| `users/{uid}/game/state` | coins, XP, level, class, equipped items/titles, title slots, pause state, calibration state, bodyweight + age + sex inputs |
| `users/{uid}/game/muscles` | per sub-muscle: best est. 1RM facts, `lastTrained`, training-week history |
| `users/{uid}/claims/{workoutId}` | claim result (coins, XP, timestamp) — idempotency record |
| `users/{uid}/snapshots/{weekId}` | weekly stat snapshot for comparisons |
| `users/{uid}/quests/{weekId}` | that week's generated quests and progress |
| `users/{uid}/inventory/{itemId}` | owned items: base item id, slot, origin rarity (tier it started at), current rarity, upgrade level, named flag (true if origin is Legendary/Mythic), source (shop/admin/boss), and `removed` once sold or salvaged |
| `users/{uid}/shop/{weekId}` | that week's reroll count and which offers were bought (the stock itself is computed) |
| `users/{uid}/battles/{id}` | battle results, cooldowns, per-player damage/heal/absorb |
| `publicStats/{uid}` | leaderboard numbers; readable under the same privacy rule as workouts |

Firestore rules: users may **read** their own game docs; **no client writes**. Add tests to `tests/firestore.rules.test.mjs`.

### 8.4 Already in place (keep)

PWA manifest, in-progress workout in localStorage, Firestore offline cache, weights stored in kg, workout UUIDs, rules tests.

### 8.5 Other existing gaps to fix along the way

- Account deletion is referenced in the rules but not implemented; add an Admin-SDK delete-account route that also removes all game data.

---

## 9. Implementation phases

1. **Foundation (DONE)** — this design doc; `src/lib/game/` config + pure functions + Vitest tests; firebase-admin setup; server-owned docs + rules + rule tests; `POST /api/claim` end to end; backfill script; custom-exercise muscle dropdown.
2. **Stats UI (DONE)** — Hero · Stats screen with radar on real data, sub-muscle breakdown, new bottom nav, Train home screen.
3. **Rewards + scheduling + quests (DONE)** — Rewards screen, scheduled workouts, weekly quests, pause mode.
4. **Items** — inventory, shop, upgrades, sets, titles. (Part A, backend and tests: DONE. Part B, UI: DONE.)
5. **Combat** — classes, weekly bosses, tower, auto-battle, cooldowns.
6. **Social** — friend leaderboards, party raids.
7. **Later** — trading.
8. **Restyle existing screens** — apply the section 7.1 look to every screen that predates the RPG (Friends feed, Profile, Settings, Calendar, Routine editor, Exercise library, Search, and the active workout). Done last, so each screen is touched once after the game adds its data to it.

---

## 9.1 Phase 8: Restyle existing screens

**Why:** Phase 2 built the new screens (Train, Hero, nav) in the section 7.1 look but deliberately left every older screen alone, so the app currently has two visual styles. This phase makes them match.

**Scope**
- Convert each older screen to the 7.1 tokens: flat dark ground (#101113), surface #17181b, hairlines #26282c, one accent #5b9bff, Barlow Condensed headings, IBM Plex Mono body.
- Remove the old per-user theme system (src/lib/themes.ts) only if the user agrees; otherwise keep it as an opt-out.
- Show game data where it belongs, once those features exist: level and title on profiles and feed posts, class badge, and gear on profiles.
- Keep every behavior identical. This phase changes appearance, not features.

**Rules**
- One screen per commit, so any screen can be reverted alone.
- Keep the same 7.1 anti-patterns list: no glow, gradients, glass panels, nested cards, badge spam, or icon-tile grids.
- Keep 44px tap targets and 390px layouts working.
- Run lint, type-check, Vitest, the rules tests and a production build when done.
- Compare each restyled screen against the same data before and after: nothing may be lost.

---

## 10. Decisions made during the build

These came up while building Phases 1 and 2 and weren't in the sections above. `src/lib/game/config.ts` and the code are the source of truth; this list explains why things behave the way they do.

**Economy and XP**
- Coins: 50 base per workout, plus a 25 scheduled bonus that follows the off-day curve (always 0 until scheduling exists in Phase 3). Daily cap 150, counted by claim day in the user's time zone, so backdating can't farm coins.
- XP: 20 per workout (at most once per 12 hours of claim time, so a third same-day workout pays stat XP only), plus 10 per power point above the user's previous peak power. The peak rule means regaining decayed stats never pays twice. No stat XP during calibration. 500 XP per level.
- Backfill computes stats and XP from history but does **not** replay coins. Each existing user gets a flat 500-coin welcome bonus instead.
- Recompute (after a workout edit or delete) rebuilds muscle facts and snapshots without touching coins, XP or claim records. It only ever lowers `peakPower`, to the highest power the corrected history reached, so fixing a typo doesn't block future XP.

**Stat math**
- Epley estimate caps reps at 12 (section 2.2); sets over 600 kg or 100 reps are ignored; workouts starting more than 24 h in the future are rejected.
- Bodyweight exercises with no weight logged count as bodyweight × 0.65; with added weight, bodyweight × 0.65 + the added weight.
- Missing bodyweight defaults to 75 kg; unknown sex averages the male and female standards. No onboarding prompts yet.
- Stats have no cap: strength keeps scaling past the standard (100), and the radar's edge becomes the highest stat shown, with the 50 and 100 rings moving inward.
- Decay: after 7 days untrained, the strength part loses 1% per day, down to a floor of 50%.
- Calibration starts at the first counted workout and ends after 14 days or 6 workouts. During it, shown stats are population averages (30 per sub-muscle) while real numbers are stored underneath.
- Weeks start Sunday; the week id is that Sunday's date (e.g. 2026-10-11). Snapshots are written at claim time.
- Workouts under 4 working sets get no claim record, so they can still be claimed if later edited up to 4+ sets.
- Free-text custom-exercise muscles are mapped to the closest of the 17 values (alias table first, then nearest spelling); the backfill logs guesses for review.

**UI (Phase 2)**
- The Friends feed stays at /home, reachable from the avatar menu ("Friends feed"). The avatar menu also holds Profile, Find friends, Calendar, Follow requests (only when pending, with a dot on the avatar), Settings and Sign out.
- New screens and the new nav use only the fixed 7.1 palette and ignore per-user themes; old screens keep their themes until Phase 8.
- The Hero screen shows a loading skeleton until Firestore answers, so established users never flash "Calibrating…".

**UI (Phase 3, Part B)**

*Rewards flow*
- `finish()` stays synchronous: one line writes a "pending" marker (workout name, start, duration, working sets, volume) to localStorage (`rewardsStore.ts`). `gameSync` stores each claim answer there and emits an event. `RewardsHost` (in `SignedInChrome`) shows a "Rewards pending" bar above the nav while a claim is queued ("Syncing — rewards when you're back online" when offline), then opens `RewardsScreen` full screen. It never opens over `/workout`; it waits until you leave.
- Which answers are shown: one the user was waiting for (a marker existed), or any `claimed` answer (old queued claims, edit claims). A repeat `already-claimed` with no marker is not shown again. A lost response that is retried still shows, because its marker survived. Unseen answers expire after 3 days; the five newest are kept.
- If the queue drops a claim (save failed, 30-day age limit, a 4xx the server won't accept) the marker is cleared. Every flush also clears markers whose claim is no longer queued, so the bar can't get stuck.
- Header: on schedule, "a day late / early", extra, or "done while paused". Early vs late comes from the slot's day against the workout's start; a claim made late on the slot's own day reads late. With no summary (claims queued before Part B) the direction isn't guessed: "Done N days off schedule". "Paused" means a pause covered the workout's day.
- XP bar: the new segment starts at `xp.balance − (xp.total + quest XP)`, because quest XP is inside the balance but not in `xp.total`. A level-up fills from zero and says "Level 26 → 27". When no workout XP was paid, the screen says it pays every 12 hours and when the next one is, from `game/state.workoutXpAt`.
- Stat changes show one decimal (62 → 64.1, +2.1), only the stats that moved, and are replaced by a calibration note while calibrating. The 1RM line is in the user's unit and names the exercise. A not-counted answer shows "3 of 4 working sets".

*Train*
- The card shows the slot a workout started now would fill, using the server's own `matchWorkout`: scheduled today (with what tomorrow pays), a make-up for a missed slot within 3 days, or the next slot (early within 3 days pays the reduced bonus; farther out pays none). A pause replaces it with the return date; logging still works. With no schedule set the old suggestion shows plus a link to the schedule editor.
- Workouts the server hasn't matched yet are matched on the device and drawn with a dashed border, with a line saying marks are predictions until sync. Strip marks: ✓ on schedule, ~ late or early (on the scheduled day), • today, empty box planned, – missed, + extra (a workout with no open slot within 3 days), blank rest.
- Each routine's next day looks 8 days ahead and skips filled slots; the same weekday a week on reads "Next Wed".

*Quests screen*
- Opening it calls `POST /api/quests` (once, and again when the device comes back online); a listener on `quests/{weekId}` keeps it current. Progress is counted on the client from the week's workouts. This screen uses the browser's time zone for the week, the same one it sends to the server.
- Claim shows only for finished, unpaid quests (needed after editing a workout). Reroll asks for confirmation, shows the price (25, then 50) and is off when coins are short or none are left.
- Schedule editor: per routine, seven day chips; a weekday holds one routine, so tapping a day another routine has moves it. Saving starts tomorrow.
- Breaks: pause by stepper (7 to 28 days) with confirmations, "End pause early" opens after 7 full days; injuries: flag up to 2 stats (date and private note optional), renew 8 weeks, clear, and the followers toggle. The panel asks `breaks.ts` itself, so it never disagrees with the server's reasons.
- Every control on this screen needs the network, so it shows "You're offline" and disables itself when there is no connection.

*Injury display*
- Your Hero shows "Injured: Arms, Legs", plus "hidden from followers" when you've turned that off. A follower's view of your profile reads `publicStats/{uid}` and drops entries whose `expiresAt` has passed, since nothing cleans that document. "Back around" appears only when every live flag has a return date, and uses the latest one.

*Not built*
- The Train mockup's "Last: Pull day · Wed · +180 coins" shows no coins (it would need a claims read). The Quests tab has the schedule editor but no calendar view (section 7.2).

**Phase 5 note: injury flags and bosses**
- Injury flags waive the boss minimum for the flagged stat (section 3.6), which makes them worth abusing. Limit renewals when boss minimums are built: for example 2 renewals, then the flag must be cleared for 7 days before a new one can be set. `Injury.renewals` already counts renewals so this needs no migration.

**Power multiplier**
- Legs and Back count **1.2x in Power only** (largest muscle groups by mass). The six radar stats stay unscaled. All other stats 1.0x. Value lives in `config.ts`. Implemented in Phase 5.

**Starting economy values (tune after ~2 weeks of real use; all in `config.ts`)**
- Income at 4 workouts/week: about 300 coins from workouts, about 450-500 with quests and boss wins.
- Shop prices: Common 150, Uncommon 450, Rare 1,000, Epic 2,500. Weekly stock of about 6 items, each marked up about 25%.
- Legendary and Mythic are not sold (boss drops only).

**Items (Phase 4, Part A)**
- Catalog: see "Catalog rules, focus and accessories" below. Base items hold names and focus only; power comes from rarity and plus.
- Piece power = base × (1 + 4% × plus). A piece promoted into a named rarity it didn't start at (Epic → Legendary, and named Legendary → Mythic) gets 85% / 88.5% / 92% of a native piece at +0 / +1 / +2.
- Upgrades: +0 → +1 → +2 → next rarity at +0, for coins and scrap (table in `config.ts`). Unnamed gear stops at Legendary +2. Named Legendary → Mythic also needs a Mythic Core, a boss-only material (Phase 5 hook; nobody can get one yet except through the admin script). An equipped item can't be upgraded into a rarity your level can't equip.
- Level to equip goes by **current** rarity: Epic 8, Legendary 15, Mythic 25. Battle power ignores pieces above your level as well.
- Shop: six offers a week per user, seeded by uid, week and reroll count, so nothing about the stock is stored. Rarity weights 35/35/20/10, at most one Epic, no base twice. Prices are the values (150/450/1,000/2,500) plus 25%, rounded to 5: 190/565/1,250/3,125. Rerolls cost 100 then 200, two a week. A buy names the week and reroll count it saw, so a reroll or week rollover in between returns 409 instead of charging, and a retried buy returns the item it already bought (the item id is derived from the offer).
- Selling pays 25% of the origin rarity's value (not the shop price), rounded to 5: 40/115/250/625, whatever the item was upgraded to, so upgrading and selling never profits. Named items can't be sold, only salvaged. Equipped items must be unequipped first.
- Salvage pays scrap by current rarity (5/15/35/80/150/250); upgrade spending isn't refunded. Sold and salvaged items keep their doc with a `removed` record, so a retry returns what it paid. Each claimed weekly quest also pays 5 scrap. A boss drop of a base you already own becomes its salvage value in scrap (`dropOutcome`, for Phase 5).
- Titles: eight achievements, all computed from stored facts. Calibrated 2%, Regular (3+ workouts a week for 4 weeks in a row) 3%, Unbroken (no skipped scheduled workout for 28 days, 8+ scheduled; a slot still inside its make-up window isn't a skip yet) 5%, Record Breaker (a 1RM bonus on 3 stats at once) 3%, Questmaster (all quests of one week claimed) 3%, Well Rounded (every stat 50+) 4%, Iron Habit (trained in 12 of the last 16 weeks) 4%, Centurion (100 counted workouts) 3%. Earning is stored (`titles.earned`) and never taken away, because some of the facts behind it (recent schedule matches, decaying stats) don't last. Claims check achievements in their own transaction (a failure there is logged and never fails the claim), and so does `POST /api/titles` when the Titles tab opens. A newly earned title fills an empty slot by itself. One slot to start; slots 2 and 3 cost 500 and 1,500 coins.
- Routes: `POST /api/shop` (buy, reroll), `POST /api/items` (equip, unequip, upgrade, sell, salvage), `POST /api/titles` (check, equip, buy-slot). Each is one transaction and safe to retry.
- `npm run grant-items -- --uid <uid> ...` grants items (source "admin") and materials for testing. Against a real project it needs `--confirm <projectId>`.

**Items (Phase 4, Part B: UI)**
- `itemsView.ts` builds what the Gear, Shop and Titles tabs show. Whether a button is on is decided by a dry run of the server's own function on a copy of the state (`applyUpgrade`, `equipItem`, `removeItem`, `buyOffer`, `rerollShop`, `buyTitleSlot`), so the reason shown under a disabled button is always the server's.
- Gear: a power block (Body without gear, Gear counted of what the 30% cap allows, Bonuses of the 25% pool, Battle), Scrap, set progress (only the best equipped set counts), and five slot rows (plus the Accessories section, below). Tapping a slot opens a bottom sheet of everything owned for it, strongest first. Equip and Unequip act at once; Upgrade, Sell and Salvage confirm first with their cost or payout. Equipped, Named and Ascended are text labels; gated gear shows "Needs level N". While calibrating the block says so and shows no battle power.
- Shop: six cards in two columns with a restock countdown (Sunday 00:00). Buy and Reroll confirm with the price. A bought offer stays in place, dimmed and marked "Bought". A 409 "restocked" answer moves the screen to the new week; the shop listener is keyed by week id, so nothing stale is shown.
- Titles: opening the tab calls `POST /api/titles` (check), which also records newly earned titles. Equipped titles list first, then earned, then by closeness to done. Equip is disabled with a reason when the slots are full.
- Hero header: "N coins · Power X · Battle Y". Battle is left out while calibrating and until the inventory has loaded. The Rewards screen lists titles earned by the claim and the scrap finished quests paid.
- Rarity colors are CSS tokens (`text-rpg-epic`, `border-rpg-legendary`, ...); icons are one flat line-art SVG per slot in the rarity color. All of it follows 7.1: no glow, gradients or rounded corners.
- Known limit: the week the Shop shows comes from the game's time zone, while buy and reroll send the browser's. They only differ for someone whose device zone isn't the one saved on their account.

**Items (Phase 4, catalog rules, focus and accessories)**
- **One data file.** `catalogData.ts` lists every item as one line (id, name, slot, rarity, optional set, effect id and focus) with a header comment on how to add one; `catalog.ts` derives the lookups. `catalog.test.ts` enforces the rules: unique ids, valid slots, focus adds up to 100, Common/Uncommon/Mythic and accessories in no set, sets only at Rare/Epic/Legendary with exactly five pieces (one per armor slot) at the set's rarity and sharing its focus, Legendary sets named and Rare/Epic unnamed, each Mythic standalone and 100% one attribute with its own unique effect, every accessory with a known effect that never touches coins or XP.
- **Kept ids.** Ironbound (Common) and Wayfarer (Uncommon) are now loose items with the same ids, so owned copies still work. Steelguard, Warden and Titan's Vow stay sets. Unbroken is five standalone Mythics (`unbroken-helmet` … `unbroken-boots`, effects `unbroken-crown` … `unbroken-path`). The stored `slot` field is unchanged for armor. Placeholder items are in the file so there is variety (extra loose Common and Uncommon items, a second Rare, Epic and Legendary set, and accessories at every rarity up to Legendary); the real items replace them later.
- **Focus.** A set's focus is shared by its pieces. A loose item has its own, or falls back to the old slot split (`GEAR.slotFocus`), so Ironbound and Wayfarer behave exactly as before. Focus is looked up in the catalog by `baseId`, so nothing is stored on owned items. Shown on cards as "HP 70 / DEF 30".
- **Set bonus.** 3 pieces +8%, 5 pieces +20% on the power of that set's own equipped pieces only, never on other gear or accessories. Only the best equipped set counts (with five armor slots two sets can't both reach three pieces, so it is the one with the most pieces). Mythic base power is 30 (was 32).
- **Accessories.** Positions `ring1`, `ring2`, `necklace`, `belt`, `charm1`, `charm2` are keys of the `equipped` map beside the five armor keys; `item.slot` is `ring`, `necklace`, `belt` or `charm`. `POST /api/items` equip takes an optional `position` (default: where the item already is, else the first empty position of its slot); unequip takes a `position`. The server refuses a position of another slot (no ring in a charm slot) and the same item in a second position, and treats a repeat of the same equip as done. They share rarities, level gates, upgrades, sell and salvage with armor, count toward the 30% gear cap and are in no set. Base power is about 40% of an armor piece: 1 / 2.5 / 4 / 6 / 9 / 12.
- **Accessory effects (Phase 5 hooks, no behavior yet).** Ring: crit chance. Necklace: healing. Belt: damage reduction. Charms: boss cooldown reduction, salvage yield, shop reroll discount. Values are small and in `config.ts` (`ACCESSORY_EFFECTS` at Legendary strength, `EFFECT_SCALE` by rarity: 20% Common … 100% Legendary). No effect may change the coins or XP earned.
- **Shop.** Each offer is an accessory with chance 30% (`SHOP.accessoryShare`), otherwise armor; rarities, the one-Epic limit and "no base twice" work as before. Adding accessories changed which items a given week's stock holds (it is computed, not stored), so offers already bought this week would show a different item as "Bought".
- **Gear tab.** Unequipped copies with the same base, rarity, plus, named flag and origin rarity show as one card with "×N"; an equipped copy is its own card, labelled Equipped (and its position for rings and charms). Equip, Upgrade, Sell and Salvage act on one copy. "N owned" on a slot row counts copies, and Ring 1 / Ring 2 (and the charms) share one count. The Accessories section sits under Equipment with the same rows and sheet and a line-art icon each for ring, necklace, belt and charm.
- `grant-items --all` grants one of every catalog item, accessories included.

**Testing (end-to-end)**
- `e2e/` holds Playwright tests that drive the real app in Chrome at 390px against the Firebase **emulators** (project `demo-dyelb`) with a seeded test user (`hero@test.dev`). Run `npm run e2e`. Nothing touches the real project, and no keys are used; see `e2e/README.md`. Google sign-in is skipped through a dev-only hook (`window.__emulatorSignIn`, present only when `NEXT_PUBLIC_FIREBASE_EMULATOR=1`).
- Covered: Gear (stacking, ring1/ring2, same item in two positions refused, sell/salvage one copy, named gear, level locks), Shop (buy, double tap, reroll, no coins), Titles, and offline mode. Add a spec for each new screen in later phases.
- Found by it: offline, the Shop shows "Can't load the shop" for a user with no `shop/{weekId}` doc (nobody who has never bought or rerolled), although the stock is computed on the device. Decide whether to render it offline (see section 11).

**Phase 5 decisions (agreed, not built yet)**
- **Content, four pieces:** the weekly boss, the endless tower, the Boss Tower and the Campaign. The weekly boss is one boss a week from a rotating list (write 8-12 bosses), at one of 5 tiers locked at week start. The endless tower is generic scaling floors, each paid once. The Boss Tower is a permanent ladder where every floor is a different named boss with its own mechanic and stat minimums, each floor paid once. The Campaign is chapters of fixed stages, cleared one by one. The campaign never drops Legendary or Mythic; Epic is very rare there because it has many stages. Boss Tower and Campaign are built after the core (classes, fight engine, weekly boss, endless tower), on the same fight engine.
- **Classes:** everyone picks a class free at level 1; switching costs 300 coins, once a week.
- **Cleric healing** comes from the Core stat, not training consistency.
- **Weekly boss limit:** one fight a day, win or lose, resetting at a fixed hour (04:00 in the user's saved time zone) instead of 24 hours after the last fight, so fighting at odd times never costs a day. The endless tower keeps its own 4-hour cooldown after a loss, with auto-climb of up to 5 floors a tap that stops at the first loss.
- **Rewards:** the first clear of the week pays more coins; refights pay about half. Drop chances are the same on every win (not guaranteed on a first clear). Duplicate drops become scrap.
- **Drops per boss win:** gear drop chance and rarity split by tier (tier 1: 1% Rare; 2: 1.5% Rare 80 / Epic 20; 3: 2% Rare 50 / Epic 45 / Legendary 5; 4: 2.5% Epic 60 / Legendary 38 / Mythic 2; 5: 3% Epic 40 / Legendary 55 / Mythic 5). Mythic Core: 2% per win at tiers 4 and 5.
- **Pity counts wins:** a Legendary is guaranteed after 42 wins without one (about 6 weeks at one fight a day), a Mythic after 210 (about 7 months).
- **Mythic effects:** Crown survives one lethal hit per fight at 1 HP; Heart reflects 15% of damage taken; Hands makes every 4th hit a crit; Pillars regenerates 3% of max HP a round under half HP; Path adds 2 rounds to the enrage timer.
- **Paused and injured:** fighting while paused is allowed, using the frozen stats. Injury flags may be renewed twice, then must stay cleared 7 days before a new one; a flag waives only that stat's boss minimum.
- **Accessory effects:** duplicates add up, each effect capped (crit 25%, healing 20%, damage reduction 20%, cooldown reduction 40%, salvage yield +50%, reroll discount 50%).
- **Boss tiers** 1 to 5, gated at levels 1, 8, 15, 25, 35; the highest your level and power allow, no opting down.

**Rollout order (not yet done; do it once, after Phase 3)**
1. Run the backfill (dry-run first, `--time-zone America/Toronto`).
2. Deploy the Firestore rules (`npx firebase-tools deploy --only firestore:rules`). Must come after the backfill, or exercises with old free-text muscles can't be edited.
3. Merge and deploy the app.
Vercel also needs FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY (Production and Preview, marked Sensitive) and Node 22+.

---

## 11. Open questions

- Exact strength-standard tables for normalizing 1RM to 0–100 (current ratios are placeholders).
- Exact decay rate after day 7.
- Final shop prices and coin numbers (starting values are in section 10).
- Shop offline: show the computed stock with buttons off when there is no shop doc yet, instead of "Can't load the shop"? (Found by the e2e suite.)

**Phase 5 (combat): still open (each has a building default, all numbers in `config.ts`)**
1. The class's share of the +25% bonus pool (titles and class add up there). *Building default:* +3%.
2. Boss Tower: attempts and cooldown, and what a floor pays. *Building default:* its own 4-hour cooldown after any fight; first clear of a floor pays coins and scrap, with gear drops on the same low-chance rule as the weekly boss.
3. Campaign: number of chapters and stages, and any limit on attempts. *Building default:* no attempt limit; coins, scrap and Common to Rare gear, Epic very rare; no Legendary or Mythic.
4. Tower floor 1 needs level 5. *Building default:* no other level gate.

---

## 12. Balance rules (agreed after review)

**Anti-abuse (soft, not blocking)**
- Bodyweight changes of more than 5% from the last entry, and any single claim that raises a stat by more than 8 points **(tunable)**, show a non-blocking "Does this look right?" notice with the sets that caused it and an Edit button. Editing triggers the existing recompute. No hard caps.
- Pity: guaranteed Legendary after **6** first-clear boss kills without one **(tunable)**. Mythic has its own longer pity.

**Power stacking**
- Gear and titles affect battle power only. The radar shows raw stats.
- Title and class percentage bonuses share one additive bucket capped at **+25%**. Set bonuses are **not** in the bucket: they multiply gear power before the gear cap.
- Gear's share of total power is capped at 30% **in the formula**: `gear ≤ 0.3 / 0.7 × body power`. Accessories count toward it.
- Battle power = `(body + min(gear, 0.3 / 0.7 × body)) × (1 + min(25%, titles + class))`, where `gear` = Σ piece power with the set bonus applied to the best equipped set's own pieces only.

**Economy**
- Sell price is 25% of buy price. Duplicate boss drops convert to salvage materials, not coins.
- Cosmetics (hero frames, banners, avatar items) are a coin sink, cosmetic only, added after the main phases.

**Stats have no cap.** They keep growing past 100; the radar axis scales to the highest stat. Verify `computeStats` and the radar don't clamp at 100.

**Gear stats (recommended starting values, tunable)**
- Power per armor piece: Common 3, Uncommon 6, Rare 10, Epic 15, Legendary 22, Mythic **30**. Each +step adds 4% of the piece's base.
- Accessory power (about 40% of an armor piece): Common 1, Uncommon 2.5, Rare 4, Epic 6, Legendary 9, Mythic 12. Same +steps, rarities, level gates and 30% cap.
- Full-set totals: Epic 75, Legendary 110 (132 with the 5-piece bonus). A Mythic is a single piece, not a set. Five Mythics are 150 gear power with no set bonus, which counts fully at an average stat of roughly 64+, so gear can't carry a weak lifter.
- Set bonus: 3 pieces +8%, 5 pieces +20% (the highest tier reached, not both), applied **only to that set's own equipped pieces** and only for your best set; it multiplies before the 30% cap. Named (Legendary) sets also get a unique effect.
- Focus replaces the fixed per-slot split: each item (or set) says how its power splits over HP / ATK / DEF. Items with no focus use the old slot split (70% primary / 30% secondary): Helmet HP/DEF, Chestplate DEF/HP, Gloves ATK/HP, Leggings HP/ATK, Boots ATK/DEF; accessories fall back to ring ATK/HP, necklace HP/DEF, belt DEF/HP, charm an even spread.
- **Intended balance of sets against Mythics** (tests in `battle.test.ts`):
  - Epic HP set (5 × 15, 100% HP) with all five equipped is 90 HP. Swapping one piece for a Mythic HP (30) gives 4 × 15 × 1.08 + 30 = **94.8** HP, so the Mythic version is better.
  - Legendary HP set (5 × 22) is **132** HP. The same swap gives 4 × 22 × 1.08 + 30 = **125** HP, so the set is better.
  - Epic ATK set with a Mythic HP piece replacing one piece: ATK drops by about 25 and HP rises by 30, a real trade-off.

**Classes must matter in fights.** Bosses need a mechanic that rewards a tank and a healer (e.g. a damage type only DEF counters, a damage-over-time only healing offsets). Otherwise everyone picks Striker.

**Check at the start of Phase 3 (ask Claude Code to confirm against `config.ts` and the code)**
1. Is there a rep cap in the Epley estimate? If not, add cap 12.
2. Do `computeStats`, `displayStats` or the radar clamp stats at 100? If so, remove it.
3. Is workout XP limited by the 12-hour rule? If not, add it.
4. Are the level gates still 20/35/50 anywhere in config? Change to 8/15/25.
