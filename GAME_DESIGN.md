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

> **Superseded in part by the stat rework (section 10, "Stat rework (built)").** Stats now come from training effort: 2.2 (strength and frequency), 2.3 (1RM bonus), 2.4 (decay, now rust) and 2.6 (starting averages, calibration, bodyweight) no longer apply. 2.1's stat groups, 2.5's power formula (with Legs and Back at 1.2) and 2.7 still do.

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

## 9.2 Rep ranges and progression (built: all 4 steps done)

Idea (Jackson): a routine exercise can carry a target rep range, for example 6-9. Different ranges are different training styles. It gives lifters a clear progress signal that does not depend on the RPG stats.

**Agreed rules**
- **Range per exercise**, custom only (no presets). Optional: older routines and exercises with no range are untouched.
- **Progressed** means a working set beat last session either with the **same weight and more reps**, or with **more weight** (at least the weight step heavier, 2.5 kg or 5 lb unless changed per exercise) with every working set at or above the range's minimum reps. A bodyweight exercise with no weight counts only more reps.
- **No gate on adding weight:** you can add weight any time, whether or not you reached the top of the range. The hint suggests adding weight when every working set reached the top, but it never blocks anything.
- **Below the minimum** the hint suggests a lighter weight. It is a neutral suggestion, never a penalty, and never wording like "failed" or "plateau" (plateaus are a normal, long phase of lifting).
- **Editing:** the range can be changed mid-workout, and the change is **saved to the routine** for next time. A workout that did not start from a routine (freestyle) keeps the change for that session only.
- **No RPG tie-ins:** no progress quest and no "Progressor" title. Progress is shown as hints and history only, so nobody is pushed to chase it (or fake it) for rewards. Nothing here pays coins or XP.
- **Stat math unchanged:** Epley still caps reps at 12, so a 12-20 range works for logging but adds nothing past 12.

**Data.** `RoutineExercise` (src/lib/types.ts) gets optional `repMin`, `repMax` and `stepKg`. `firestore.rules` only checks a routine's top-level keys, so no rules change; the editors validate (1 to 30, min at most max).

**Logic (pure, tested): `src/lib/game/progression.ts`.** `progressionStatus(range, sets)` returns `add-weight` (every working set reached `repMax`), `in-range`, `below-range` (a working set under `repMin`) or `no-range`. `didProgress(previousSets, sets, stepKg)` implements the rule above (warm-ups ignored, drop sets handled). `nextWeight(lastWeightKg, stepKg, unit)` suggests the next load, rounded to what the unit can load. It reads the last session of that exercise from the workouts already loaded for the "previous" column and stores no new facts.

**Build order (small phases, each ends with lint, tsc, vitest, next build, the e2e suite and a 390px check):**
1. **Done:** data and pure functions with unit tests (`RoutineExercise.repMin/repMax/stepKg` in `types.ts`, `PROGRESSION` in `config.ts`, `src/lib/game/progression.ts` and its 32 tests: boundaries, warm-ups, drop sets, mixed weights, bodyweight, the step rule, unit rounding). Warm-ups and drop sets are ignored, and "same weight" means within 0.01 kg.
2. **Done:** routine editor: a min and max control per exercise, empty by default, plus an optional weight step (in the user's unit, saved in kg) that shows once there is a range. A half-typed, reversed or out-of-bounds range shows a message and blocks Save (`repRangeProblem`). Clearing the range removes all three fields (`withRepRange`), never writes `undefined`, which Firestore refuses. The new inputs are 44px tall; the rest of that old-style screen waits for the Phase 8 restyle.
3. **Done:** workout screen: each exercise card shows "Target 6-9 reps" with an Edit button, or "Set target reps" when it has none, and a one-line hint from the last session (`progressionHint`: add weight when every set reached the top, the same weight with "aim for the top" in range, a lighter weight under the minimum, worded neutrally). Editing is a small inline editor (min, max, Save, Cancel) that saves to the routine the workout started from (`DraftWorkout.routineId`, `saveRoutineRepRange`, first exercise with that id, quietly skipped if the routine is gone); a workout that did not start from a routine keeps the change for that session and says so. Read-only next to the sets: logging itself is unchanged.
4. **Done:** e2e (`routines.e2e.ts`, `workout-targets.e2e.ts`): the editor, the three hints, mid-workout change saved to the routine, clearing, a regression check that logging a set still works. Not covered: a freestyle workout (no routine) saving for the session only, which the unit tests cover.

**Model:** Sonnet is enough. Built before Phase 5.

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
- Injury flags waive the boss minimum for the flagged stat (section 3.6), which makes them worth abusing. Built in piece 2: 2 renewals, and a stat waits 7 days after any flag on it ends before a new one.

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
- Titles: eight achievements, all computed from stored facts. First Steps (6 counted workouts; was Calibrated before the stat rework) 2%, Regular (3+ workouts a week for 4 weeks in a row) 3%, Unbroken (no skipped scheduled workout for 28 days, 8+ scheduled; a slot still inside its make-up window isn't a skip yet) 5%, Record Breaker (beat your last session on exercises of 3 stats in one workout; was a 1RM bonus on 3 stats) 3%, Questmaster (all quests of one week claimed) 3%, Well Rounded (every stat 50+) 4%, Iron Habit (trained in 12 of the last 16 weeks) 4%, Centurion (100 counted workouts) 3%. Earning is stored (`titles.earned`) and never taken away, because some of the facts behind it (recent schedule matches, training weeks) don't last. Claims check achievements in their own transaction (a failure there is logged and never fails the claim), and so does `POST /api/titles` when the Titles tab opens. A newly earned title fills an empty slot by itself. One slot to start; slots 2 and 3 cost 500 and 1,500 coins.
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
- Found by it, then fixed: offline, the Shop used to say "Can't load the shop" for a user with no `shop/{weekId}` doc (anyone who has never bought or rerolled). The stock is computed from the week, so it now shows with the buttons off, a note that anything bought on another device appears once back online, and the usual offline line. If the player's own data was never loaded either (a first-ever offline open), it still can't show coins.

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
- **Boss tiers** 1 to 5, gated at levels 1, 8, 15, 21, 35 (tier 4 was 25 until the pacing tuning); the highest your level and power allow, no opting down.

**Phase 5 decisions, round 2 (agreed; these win where they differ from the list above)**
- **Bosses:** the weekly boss has its own pool of 12 unique bosses (one a week, repeating every 12 weeks, scaled to your tier). The Boss Tower has its own 30 unique bosses, one per floor. The Campaign has 5 chapter bosses; its other stages are regular enemies. Claude drafts all names and mechanics in `bossData.ts`; Jackson reviews them there before anything is built on them.
- **Fights are timed, like AFK Arena, not round-based.** Both sides attack on their own timers. Each class has one skill on a cooldown (about 6 s) and an ultimate charged by energy (+8 per hit landed, +12 per hit taken, fires at 100). Bosses telegraph big hits a few seconds ahead and have bleed (ignores DEF; only healing offsets it) and enrage (at 45 s the fight is lost). Fights run on the server as one deterministic calculation from a seed. After a fight: a result screen with a collapsible timestamped log; an animated replay comes later.
- **Classes:** the +25% pool bonus stays small, +3% for any class. Classes differ through weights and skills:
  - Vanguard: HP and DEF x1.3, ATK x0.7. Skill Guard (halves damage taken for 3 s; held for telegraphed big hits). Ultimate Bastion (a shield).
  - Striker: ATK x1.4, HP x0.9, DEF x0.8. Skill Power Strike (2.2x hit). Ultimate Execution (4x hit).
  - Cleric: HP x1.1, ATK x0.8. Skill Mend (heals 25% of max HP, scaled by the Core stat; Cleric only). Ultimate Radiance (big heal that clears bleed).
  - A necklace's healing works at half strength for anyone who isn't a Cleric.
- **Boss Tower:** opens at level 15; its own 4-hour cooldown after any fight, win or lose. A floor's first clear pays the most: coins, scrap and a 15% gear chance at the floor's tier, plus a Mythic Core chance on every 10th floor. Reclearing an easier floor pays gold only, about 10% of the first clear, no scrap or gear.
- **Campaign:** 5 chapters of 12 stages (60) at launch, opens at level 1, no cooldown or attempt limit. Only your next uncleared stage can be fought (no replays to farm).
- **Endless tower:** only your next uncleared floor can be fought.
- **Combat numbers** (damage formula, boss power per tier and floor, timers) are Claude's first draft; after building, a win-chance table (by class, boss type and power ratio) is shown for tuning. Target: a hero at a boss's recommended power wins about 65% of the time, and the chance rises smoothly with power.

**Phase 5, piece 1 (built): fight engine, bosses, loot**
- Pure and tested, nothing on screen yet: `combat.ts` (hero and enemy, the timed fight), `effects.ts` (gear effects), `bossData.ts` (the 47 bosses, a draft for review), `bosses.ts` (weekly rotation and tier, towers, Campaign stages, stat minimums), `loot.ts` (drops, guarantees, payouts), and every number in `config.ts` (`CLASSES`, `SKILLS`, `COMBAT`, `WEEKLY_BOSS`, `BOSS_DROPS`, `ENDLESS_TOWER`, `BOSS_TOWER`, `CAMPAIGN`, `MYTHIC_EFFECTS`).
- Changes made while tuning (all in config):
  - Defense counts against its owner's battle power (hit × K / (K + DEF), K = 0.29 × the defender's power), so a fight plays the same at any power level and class weights stay linear.
  - Each side rolls a "form" once per fight (±12% damage), so fights near even power can go either way instead of the stronger side always winning.
  - Vanguard's Bastion also slams for 3× attack (otherwise Vanguards could not kill before the enrage), and Guard is held for telegraphed big hits or used below 60% HP. Vanguard weights are HP and DEF ×1.2 (not 1.3) and it attacks every 0.9 s.
  - Mend heals 6% + 7% × (Core ÷ your average stat), up to 25%: a Core stronger than your other stats heals more, at any power.
- Win chance at even power (`npm run combat-table`, 1,000 fights each). Each special type has a class that handles it best and one that struggles; real bosses mix types.

| Boss type | Vanguard | Striker | Cleric |
| --- | --- | --- | --- |
| plain | 67% | 65% | 61% |
| brute (big telegraphed hits) | 85% | 64% | 30% |
| bleeder (damage DEF can't stop) | 0% | 65% | 91% |
| timer (early enrage) | 60% | 100% | 2% |
| mixed | 62% | 80% | 42% |

  At 0.9× power a hero mostly loses (0 to 30%), at 1.1× mostly wins (85 to 100%), so the weekly tier (picked at 90% of a tier's power) is a real but fair fight.
- **Waiting on Jackson:** review the boss names, descriptions, types and minimums in `bossData.ts` before the server and screens are built on them, and say if any class matchup above feels wrong.

**Stat rework (agreed 2026-10-28, built 2026-10-29; replaces the strength-standard stats of sections 2 and 10)**
- **Why:** the game should reward showing up. Stats grow every time you train and never stop growing, so someone who has trained on the app for a year is ahead of a stronger newcomer. Progressing in the gym earns a little extra.
- **Points:** each working set earns 1 point for its exercise's stat (the muscle the exercise is tagged with; bench → Chest, rows → Back). A set that beats your last session of that exercise earns **1.25** (the "progressed" rule from section 9.2: more reps at the same weight, or more weight by at least the step with every set at the minimum reps). Weight only matters through "did you beat your last session".
- **Stat = points ÷ 10**, no cap. Sub-muscles (lats, quads...) stay on the Stats screen as a breakdown. Body power = the stats added up (Core ×0.5, Legs and Back ×1.2); battle power as before (gear up to 30%, titles and class up to +25%).
- **What counts:** working sets only. Normal, drop and failure sets count; warm-ups don't. At most 8 sets per muscle group per workout count. Workouts under 4 working sets don't count (as now).
- **Gone:** bodyweight, sex, age, estimated 1RM and the strength-standard tables no longer feed stats (personal records still show as now). Calibration goes away: new players start every stat at 0. Existing players get stats recomputed from their whole workout history (backfill).
- **Decay becomes rust:** stats never lose earned points. A muscle group untrained for 14+ days fights at reduced strength, −1% a day to at most −30%; training it once restores it fully.
- **Pacing (target):** for someone training 4 times a week at about 16 working sets: weekly boss tier 1 at once, tier 3 at about 8 months, Campaign finished at about 9 months, tier 4 at about 14 months, **tier 5 (endgame) at about 24 months**, Boss Tower floor 30 at about 30 months. Rough stat curve: each stat about 28 at 6 months, 55 at 1 year, 110 at 2 years; battle power about 460 at 1 year and 900 at 2 years with decent gear. The existing boss powers already fit this; check with a new "months to reach" table beside the win-chance table.
- **Levels on the same clock:** retune XP per level so level 35 (weekly tier 5) arrives around 2 years of consistent training; Mythics (level 25) and the other gates follow.
- **Titles that change:** "Calibrated" becomes **First Steps** (6 workouts logged). Record Breaker (a 1RM bonus on 3 stats) needs a new rule, for example "progressed sets in 3 stats in one workout". Well Rounded (every stat 50+) keeps working on the new scale.
- **Content stays at 5 weekly tiers** for now; Jackson adds content later.

**Stat rework (built): how it works and what was decided while building**
- **Facts:** `game/muscles` keeps, per sub-muscle, `sets` (counted working sets), `progressed` (those of an exercise that beat its last session), `lastTrained` and `weeks`. Points and stats are computed from them (`score.ts`), so changing 1 / 1.25 / ÷10 needs no migration; changing the 8-set cap or the step needs a recompute.
- **"Beat your last session":** `didProgress` on the whole exercise, so every working set of that exercise (drop and failure sets included) earns 1.25. Workouts don't store the routine's range or step, so stats use repMin 1 and a fixed 2.25 kg step (`STAT_POINTS.stepKg`), which replays the same forever. The last session is the newest earlier workout with working sets of that exercise, counted or not; the first time earns 1.0. The claim reads it with an `exerciseIds` query in its transaction (the existing index); recompute and backfill walk the history in order with the same rule.
- **Cap:** at most 8 sets per **stat** per workout, progressed sets first. A set over the cap earns nothing but still marks its muscle trained.
- **Stats:** a stat is the **sum** of its sub-muscles' points ÷ 10 (the sub-muscle weights only pick quest targets now). The Stats screen shows one decimal under 10, whole numbers above; the breakdown shows each sub-muscle's score and when it was trained.
- **Rust:** per stat, from its most recently trained sub-muscle. From day 14 untrained, 1% a day (day 14 is −1%), at most 30%. Pauses and that stat's injury flags stop the clock. Only fights use it: the Hero header's Battle number and the Gear panel's Body start from the rusted body power; the radar, Power, stat XP, quests and titles use earned stats. The Stats tab shows "Rusty: Legs −12%, …" when any stat is rusty.
- **XP:** unchanged rules (20 per workout, once per 12 hours; 10 per power point above peak; quest XP). Every workout raises stats, so every workout pays stat XP. **600 XP per level** (was 500) puts level 35 at about 24 months (`npm run pacing-table`).
- **Titles:** First Steps = 6 counted workouts (2%); stored "calibrated" titles read as First Steps. **Record Breaker** = beat your last session on exercises of 3 different stats in one workout (3%), from `game/state.mostStatsBeaten`, which claims raise and recompute rebuilds.
- **Rewards screen:** stat changes as before, plus "Beat last time: Bench Press, Squat (+25% points)". Older claims and snapshots that stored `{ value, bonus }` still read.
- **Moving existing games:** `npm run backfill -- --rework` replays stats, peak, workout XP and level from the whole history and adds the XP of claimed quests; coins, items, titles, breaks and claim records stay; snapshots are rebuilt; running it twice gives the same result. It drops the retired `calibration`, `bodyweightKg`, `age` and `sex` fields. The backfill now refuses to write to a real project without `--confirm <projectId>`.
- **Pacing (`npm run pacing-table`, steady player: 4 workouts a week, 16 sets split chest 3 / back 3.5 / shoulders 2.5 / arms 3 / legs 3 / core 1, 15% progressed, two quests a week, assumed gear 75 at a year and 132 at two, +8% bonuses):** average stat 29 at 6 months, 58 at a year, 115 at two; battle power 473 at a year, 926 at two. Content in months (target → model): weekly tier 1 available at once, but its recommended power at 3.5; tier 3 8 → 9.9; tier 4 14 → 16.8 (held back by level 25); tier 5 24 → 24.0; Campaign finished 9 → 11.1; Boss Tower floor 30 30 → 33.2; level 35 24 → 24.0. Retuned after piece 2: see "Pacing tuning".

**RPE and RIR (agreed, built 2026-10-29)**
- Optional per set, blank by default. Stored as one number (RPE, half steps); Settings chooses whether it shows as RPE or RIR (RIR = 10 − RPE).
- Tapping the set number while logging opens a small picker with the set type (normal, warm-up, drop, failure; these already exist) and RPE/RIR together, since a set row has no room at phone width.
- RPE does **not** affect stats (it is self-reported, so it would invite logging RPE 10 on everything). It is for logging and insight.
- Built: the picker offers RPE 5 to 10 in half steps (RIR 5 to 0) plus "–" for none, stored as `rpe` on the set only when given (`src/lib/effort.ts`). Tapping the set number opens it on the workout and edit screens; it replaces the old tap-to-cycle type. A set row shows "@8" or "2 RIR" under its number; saved workouts show "100 kg × 5 @8" or "100 kg × 5 · 2 RIR" in the viewer's scale. Settings has "Set effort: RPE / RIR" (`users/{uid}.effortScale`, missing means RPE; the rules allow only those two).

**Phase 5 decisions, round 3 (agreed 2026-10-28)**
- **Class pick:** new accounts pick a class during sign-up; existing accounts pick once on their next visit (free). After that, one switch every **7 days since the last switch**, 300 coins.
- **No charm shortens fight timers.** The Boss Tower and endless tower 4-hour timers are fixed for everyone. The boss cooldown effect is replaced by **Haste** (skill and basic attacks come faster, not the ultimate; 10% at Legendary, cap 25%). Hourglass Charm and Chrono Charm become Haste charms.
- **Ult charge** is a new effect (the ultimate's energy fills faster; +15% at Legendary, cap +40%).
- The salvage charm adds its share to scrap from salvaging; the reroll charm discounts **Shop** rerolls only (not Quest rerolls). Both round to whole numbers.
- **Legs and Back count 1.2× in Power**, done with the stat rework; peak power is raised by the same amount so it pays no XP windfall.
- Weekly boss wins and Boss Tower first clears count toward the Legendary and Mythic guarantees; Boss Tower reclears, the Campaign and the endless tower don't.
- **Boss minimums:** base them on what a typically geared hero has at the boss's power (gear and titles included), not on stats alone, so late Boss Tower floors ask for reachable stats.
- **Gear expansion (built 2026-10-29, see "Gear expansion (built)"):** 10 new effects (Haste, Ult charge, Lifesteal, Crit damage, **Executioner** (extra damage to enemies under 30% HP), Guard duration, Bastion shield, Thorns, Heal power, Bleed resistance); 3 new Cleric sets (Lightwoven, Dawnkeeper, Seraph's Grace) so every rarity has a set per class, with a 5-piece effect on Epic and Legendary sets; 6 new Mythics (Executioner's Ring, Bloodletter Gauntlets, Bulwark Plate, Oathkeeper Belt, Saint's Locket, Dawn Censer); 20 new accessories, one per accessory slot per rarity. A "fully geared" row per class joins the win table.
- The Game Wiki (a shared doc, "DoYouEvenLogBro Game Wiki") documents every class, ability, effect, item and enemy as built, plus the proposals. Keep it in step when these land.

**Gear expansion (built): what was decided while building**
- Names as drafted in the Game Wiki, except the effect "Executioner" is **Finisher** (the Striker ultimate stays Execution; the Mythic Executioner's Ring keeps its name).
- Effects live in `config.ts` (`ACCESSORY_EFFECTS`, `COMBAT.effectCaps`, `COMBAT.mythic`, `COMBAT.finisherBelowPct`) and run in `combat.ts`: Haste shortens basic attacks and the skill cooldown (not the ultimate); Ult charge multiplies energy gained; Lifesteal heals quietly (no log line, counted in healed); Crit damage multiplies the 1.6× crit; Finisher adds damage under 30% enemy HP; Guard duration and Bastion shield scale those Vanguard abilities; Thorns reflect a share of each physical hit taken; Heal power scales Mend and Radiance; Bleed resistance reduces bleeding.
- Mythics: Executioner's Ring (every hit on an enemy under 30% is a crit), Bloodletter Gauntlets (crits heal 30% of their damage), Bulwark Plate (50% reflect while Guard is up), Oathkeeper Belt (Bastion's shield ×1.25), Saint's Locket (Mend stops bleeding 4 s), Dawn Censer (overhealing becomes a lasting shield, up to 15% of max HP). Mythic accessories are 100% one attribute, like Mythic armor.
- Sets: one per class at each rarity (Steelguard / Thornweave / **Lightwoven** at Rare, Warden / Stormcaller / **Dawnkeeper** at Epic, Titan's Vow / Ashen Covenant / **Seraph's Grace** at Legendary). Epic and Legendary sets add an effect with all 5 pieces (`SETS[].effect` in `catalogData.ts`), counted toward the same caps; the Gear tab's set progress names it.
- **Tuning:** fights are steep around even power (0.9× wins about 10%, 1.0× about 70%), so the Wiki's draft values made a fully geared hero win 100% at 0.8×. All combat effect values and caps are **half the Wiki draft** (Haste 5% at Legendary, cap 12.5%; Crit chance 2.5%, cap 12.5%; set effects halved too), Oathkeeper is ×1.25 instead of ×2, and a necklace heals non-Clerics at 25% (was 50%). Salvage yield and the reroll discount (outside fights, piece 2) are unchanged.
- `npm run combat-table` now prints a "+" row per class with an endgame loadout's effects at the same battle power (`FULLY_GEARED` in `combatTuning.ts`). At 0.9× / 1.0×: plain Vanguard+ 86% / 100%, Striker+ 66% / 100%, Cleric+ 61% / 98%; brute Vanguard+ 99% / 100%; bleeder Cleric+ 66% / 98%, Vanguard+ 3% / 46%; timer Striker+ 100% / 100%, Cleric+ 0% / 2%. Gear is worth roughly 7-10% power and every class keeps its matchups. The no-gear rows moved slightly since piece 1 (plain Vanguard 78% at 1.0×) because Legs and Back now count 1.2× in power.
- Effects stay "(not active yet)" on item cards until fights ship (piece 2 and 3).

**Phase 5, piece 2 (built 2026-10-29): fight routes, classes, charms, minimums**
- **Routes.** `POST /api/fight` `{ mode, requestId, floor?, climb? }` with mode `weekly`, `endless`, `bossTower` or `campaign`, and `POST /api/class` `{ action: pick | switch, classId }`. Each is one transaction and safe to retry. Pure rules in `fights.ts` (`runFight`, `applyFightRewards`, `fightHero`) and `heroClass.ts`; the transactions in `src/lib/server/fights.ts`.
- **Stored.** `game/battle` holds progress: this week's weekly boss (`weekId`, locked `tier`, `wins`, `fights`, `lastFightDay`), endless and Boss Tower `cleared` and `cooldownUntil`, Campaign `cleared`, and the guarantee counters (`pity`). Each request writes `fights/{requestId}`: mode, seed, class, battle power, every round with its full log and the minimum check, coins, scrap, Mythic Cores, new items and duplicates turned to scrap. Both are server-written only (rules and tests added). A retry with the same `requestId` returns the stored record ("already-fought"); the seed is made on the server, so nobody can search for a winning one.
- **Hero.** Fights use rusted stats, worn gear (its effects too), titles and class; a paused player fights with frozen stats (rust doesn't run). An injury flag waives only that stat's minimum. No class picked means no fights ("Pick a class first").
- **Weekly boss.** One fight a fight day, win or lose. The fight day and week turn at 04:00 in the **saved** time zone (`game/state.timeZone`, not the device's), so a zone change can't buy a fight. The tier is locked by the week's first fight from the level and battle power then (the doc's "week start"; nothing runs at Sunday 04:00). The week's first win pays in full, later wins half. Wins count toward the guarantees.
- **Endless tower.** Level 5+. Only the next floor; `climb: true` fights up to 5, stopping at the first loss. A loss closes the tower for 4 hours; wins never do.
- **Boss Tower.** Level 15+. Any cleared floor or the next one (`floor`, default the next). Every fight closes it for 4 hours. A first clear pays coins, scrap, the 15% gear chance and the Core chance, and counts toward the guarantees; a reclear pays 10% of the coins and nothing else.
- **Campaign.** Only the next stage, no cooldown; the chapter boss (stage 12 of each chapter) checks its minimums. Never counts toward the guarantees.
- **Drops.** New items get ids `fight-{requestId}-{n}` and source "boss". A base already owned, or dropped twice in one climb, becomes its salvage value in scrap.
- **Classes.** `game/state.classId` and `classSwitchedAt`. The first pick is free (sign-up for new accounts, next visit for existing ones: the screens are piece 3). A switch costs 300 coins (`CLASS_SWITCH`), once every 7 days since the last switch (the free pick doesn't start the wait). The class's +3% now counts in the Gear tab's battle power too.
- **Charms outside fights.** Salvage yield adds its share to salvage scrap; the reroll discount lowers **Shop** rerolls (not Quest rerolls). Both round to whole numbers, on the server and in the Gear and Shop views (100-coin reroll with a Legendary charm: 85).
- **Boss minimums** are shares of `typicalStats(power)` (`pacing.ts`): each stat of the pacing model's steady player at the moment their battle power, gear and bonuses included, reaches the boss's power. They are per stat, so Core asks for much less than Back (people train it less). At 150 power a typical hero has about Chest 20, Back 23, Core 7 (the old formula asked 27 for every stat); at Boss Tower floor 30 (1,235) about Chest 178, Back 208, Core 59 (was 225), so every floor is reachable. `COMBAT.powerPerStat` is gone. `milestones()` moved to `milestones.ts` to keep `bosses.ts` â†’ `pacing.ts` free of a cycle.
- **Injury flags.** At most 2 renewals (`INJURY.maxRenewals`); a stat can be flagged again only 7 days after its last flag ended, cleared or expired (`reflagWaitDays`), so clear-and-reflag can't dodge the limit. The Breaks panel greys out Renew ("No renewals left") and the waiting stats.
- `e2e/fights.e2e.ts` drives both routes through the real server (no screens yet); `gameApi.ts` has `pickClass`, `switchClass` and `fight` for piece 3.

**Pacing tuning (agreed 2026-10-29, after piece 2)**
- Weekly tier 1's recommended power is **60** (was 150): winnable at about 1.4 months instead of 3.5. Tiers 2-5 unchanged.
- Weekly tier 4 opens at **level 21** (was 25): about 14 months. Mythics stay at level 25 (about 17 months), so a tier 4 Mythic drop waits a few levels to be worn.
- Campaign growth **2.2%** a stage (was 2.5%): the last stage is about 360 power, finished at about 9.2 months.
- Boss Tower growth **4.7%** a floor (was 5%): floor 30 is about 1,140 power, reached at about 30.2 months.
- `npm run pacing-table` now meets every target: tier 1 1.4, tier 3 9.9 (target 8), tier 4 14.1, tier 5 24.0, Campaign 9.2, Boss Tower floor 30 30.2, level 35 24.0 months.

**Build order for the next sessions** (each piece committed, with lint, tsc, vitest, next build, the e2e suite and a 390px check):
1. ~~Stat rework~~ (built 2026-10-29, see "Stat rework (built)").
2. ~~RPE/RIR picker on the workout screen and the Settings toggle~~ (built 2026-10-29).
3. ~~Gear expansion~~ (built 2026-10-29, see "Gear expansion (built)").
4. ~~Phase 5 piece 2: server routes (four fight modes, class pick and switch), Firestore rules and tests, the charm effects outside fights, the boss minimum baseline fix~~ (built 2026-10-29, see "Phase 5, piece 2 (built)").
5. Phase 5 piece 3: the Battle screens. Piece 4: e2e specs.

Replaced by the order in section 13 (agreed 2026-10-29): levels 1-100 and level rewards first, then the Battle screens, two weeks of real use, then the item rework.

**UI polish (Hero and Quests wording)**
- Gear cards: a level-gated item keeps its Equip button, disabled, with a lock and the level inside it ("Equip 🔒 25"); Shop cards show a small lock and the level. The upgrade level is shown only once above zero, in brackets after the rarity ("Mythic", "Mythic (+1)"), everywhere (rows, cards, the confirm dialogs). The four helper lines under a card (upgrade preview, "act on one of your N", level, "named gear can't be sold") are gone. A line appears under the buttons only when something is greyed out for a non-obvious reason: an Upgrade the player can't afford, or "Unequip it to sell or salvage it" on an equipped item. The upgrade cost lives in the confirm dialog.
- An item's stats are always shown attack, then health, then defense ("ATK 80 / HP 20"), never by size, and a stat at 0 is left out. An equipped slot's row has two lines: rarity and power, then the stats.
- The Accessories description is gone. Pause, Injuries and the Shop description sit behind a small info icon next to their heading that expands the text in place (collapsed by default), not a dialog.
- Rerolls show how many are left ("Rerolls left: 1 of 2") instead of their prices. The Shop button still carries its price ("Reroll for 100 coins"), since that is where you spend it, and the Quests reroll price is in its confirm dialog.
- The Titles tab's list is headed "Titles" (not "Achievements"), with one line-art icon per title: First Steps a target, Regular a calendar check, Unbroken a chain link, Record Breaker a trophy, Questmaster a scroll, Well Rounded a hexagon, Iron Habit a flame, Centurion a crown. Lit in the accent color once earned, muted before. The icons show in the list only.

**Rollout order (not yet done; do it once, after Phase 3 and the stat rework)**
1. Run the backfill, dry-run first: `npm run backfill -- --rework --dry-run --time-zone America/Toronto`, then `npm run backfill -- --rework --time-zone America/Toronto --confirm <projectId>`. `--rework` only matters for accounts that already have a game; others get a new one from their history.
2. Deploy the Firestore rules (`npx firebase-tools deploy --only firestore:rules`). Must come after the backfill, or exercises with old free-text muscles can't be edited.
3. Merge and deploy the app.
Vercel also needs FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY (Production and Preview, marked Sensitive) and Node 22+.

---

## 11. Open questions

- Final shop prices and coin numbers (starting values are in section 10).

**Phase 5 and the stat rework:** From the pacing table (before tuning): with flat levels, level 25 (tier 4, Mythics) comes at about 17 months, not 14; the Campaign finishes at about 11 months (target 9) and Boss Tower floor 30 at about 33 (target 30); a new player needs about 3.5 months to reach weekly tier 1's recommended power. Tuned after piece 2 (see "Pacing tuning" in section 10); only tier 3 (9.9 months, target 8) is still off. The radar's edge is still 100, so a new player's shape starts as a dot.

**Phase 5 (combat):** nothing open. Decisions are in section 10 (both Phase 5 blocks). The combat numbers get tuned after the win-chance table.

---

## 12. Balance rules (agreed after review)

**Anti-abuse (soft, not blocking)**
- Bodyweight changes of more than 5% from the last entry, and any single claim that raises a stat by more than 8 points **(tunable)**, show a non-blocking "Does this look right?" notice with the sets that caused it and an Edit button. Editing triggers the existing recompute. No hard caps.
- Pity: guaranteed Legendary after **42** boss wins without one, Mythic after **210** (superseded the earlier "6 first-clear kills"; see section 10, Phase 5 decisions).

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

---

## 13. Next plan (agreed 2026-10-29, not built)

Agreed in conversation after Phase 5 piece 2. Numbers marked *draft* get tuned with the pacing and combat tables, as before.

### 13.1 Build order
1. ~~**Levels 1-100 and level rewards** (13.2, 13.3), plus fight energy from workouts (13.7) and the anti-farming guard (13.8)~~ (built 2026-10-30, see 13.13).
2. ~~**Battle screens** (Phase 5 piece 3) on the current items, with the loot moments of 13.9~~ (built 2026-10-30, see 13.14).
2b. **Enemy icons** (13.15), in stages: ~~fallbacks, chapter and weekly bosses~~ (built 2026-10-30), then the 30 tower bosses and 15 Campaign enemies in later batches. Sonnet.
2c. *Optional, not yet agreed:* a live fight replay (play the stored events back with health bars, speed toggle and skip; needs health values on each fight event).
3. **Two weeks of real use**, then retune from real fight records (13.11).
4. **Item rework:** item level + rarity (13.5), weapons (13.6). One or two sessions, **on Opus**; the Gear and Shop tabs are reworked with it. Gear and weapon icons (13.15) follow once the item list settles.
5. **Phase 6:** party raids (13.10) and friend leaderboards.

### 13.2 Levels 1-100
- Level 100 at about **2 years** for the steady pacing player, on a **curve**: early levels every workout or two, later ones about every 10 days (roughly a level-up a week on average). Rough target: level 10 at ~3 weeks, 20 at ~2 months, 40 at ~6, 60 at ~11, 80 at ~17, 100 at ~24 months.
- Every gate (weekly tiers, endless tower, Boss Tower, equip levels) is re-placed **by target month** with `npm run pacing-table`, so content opens when it does now. Tier 5 stays the endgame, at level 100.
- **After 100:** the XP bar keeps filling and every so often pays a small cosmetic or title reward, so a workout always pays something.

### 13.3 Level-up rewards and stat points
- Every level pays some coins and scrap, with a bigger reward every 10 levels (*draft*; budgeted with an economy check like the pacing table so it doesn't flood the Shop).
- Every level also gives a **stat point** to put into one of the six muscle stats:
  - Each point adds a **percent** of that stat in fights (*draft* +0.5%), so it compounds with training; a neglected stat gets almost nothing from points.
  - **Fights only.** The radar, Power, stat XP, quests and titles keep using earned stats, and points never count toward **boss minimums**.
  - Capped per stat; a full level-100 build is worth about **+8-10% battle power**, like a full endgame loadout's effects.
  - **Respec** for a **flat fee** in coins (*draft*).

### 13.4 Dropped: sets by rarity bands
Considered and dropped: rarity tied to level bands (Common 1-5 up to Mythic 95-100). Replaced by 13.5, which keeps every rarity possible at every level.

### 13.5 Items: item level + rarity
- **Item level** comes from where it dropped (Campaign stage, tower floor, weekly tier), near the player's level. **Rarity** is a separate roll: a level-30 drop can be Common or Legendary.
- **Power = base power for its level × a rarity multiplier** (*draft*: Common 1.0, Uncommon 1.15, Rare 1.3, Epic 1.5, Legendary 1.75, Mythic 2.0), so a Legendary is worth roughly a Common about 20 levels higher. The 30% gear cap stays. Effects keep scaling with rarity (`EFFECT_SCALE`).
- **Named sets per level range (option B):** one set per class every 20 levels (1, 20, 40, 60, 80), 15 sets, each available in every rarity, with its own name and identity. A piece's exact level is wherever it dropped ("Steelguard" covers 20-39). Loose pieces and weapons fill the gaps. Claude drafts the names in `catalogData.ts` for review.
- **Mythics** stay unique items with their own effect, dropping only late (weekly tiers 4-5, top Boss Tower floors), with item levels like everything else.
- You can't wear an item above your level. The Shop stocks your level, Common to Epic.
- **Upgrades:** plus levels only; the rarity upgrade (Rare to Epic) goes. Named Legendary to Mythic with a Mythic Core stays as the endgame path. New: **reforge** spends scrap to raise an item to your current level, so a great roll doesn't go obsolete.
- Salvage pays scrap by item level and rarity. Existing items need a migration (an item level from their rarity's old equip level).

### 13.6 Weapons
- One **weapon** slot: the strongest single piece (*draft* about 2× an armor piece), counted toward the 30% gear cap, not part of sets.
- **Sword:** mostly ATK, crit damage. **Staff:** less ATK, boosts healing (Mend, Radiance, the necklace). **Shield:** mostly DEF, a little ATK, boosts Guard and Bastion.
- **Open to every class**, with a bonus for the class's matching weapon. Every weapon deals damage, so a Cleric can solo the Campaign and towers.
- Rarity outweighs type: a staff is weaker than a sword of the same level and rarity, but **an Epic staff out-damages an Uncommon sword** (tested). Needs a full combat-table retune.

### 13.7 Fights tied to training
- Each counted workout gives **fight energy** (*draft*: 3 Campaign or endless tower attempts, capped), so the game pulls you to the gym instead of competing with it. The weekly boss stays one free fight a day; the Boss Tower keeps its 4-hour timer.

### 13.8 Anti-farming
- Bigger rewards make fake sets more tempting. Add **at most 2 counted workouts a day**; keep the 8-sets-per-stat cap, the "Does this look right?" notice (section 12) and the social check of friends seeing workouts. Nothing blocks a real user.

### 13.9 Loot and level-up moments (Battle screens and Gear tab)
- **Loot reveal:** the item card flips in its rarity colour; Legendary and Mythic get a bigger moment. Level-ups get one too. These two are an **exception to 7.1's "no glow, gradients"**.
- **Visible guarantees:** "Legendary guaranteed in 6 wins".
- **Compare arrows** against what's worn (green up, red down) and a "best gear" equip button.
- **Auto-salvage below a chosen rarity**, since the item model drops a lot.
- Later: an animated fight replay (section 10, Phase 5 round 2).

### 13.10 Party raids (Phase 6; updates section 4.3)
- Members within about **±25 levels** on the 1-100 scale (was ±10 on 1-35).
- Loot is rolled at each player's own item level, with their own rarity roll.
- Roles come from class and weapon (shield tank, staff healer, sword damage).
- The fight engine grows to several heroes in one fight (boss targeting, heals on teammates). Likely asynchronous: the party gathers in a lobby and the server runs one fight with everyone's hero, so nobody needs to be online at the same moment.
- **Seasons** later: for example a seasonal endless tower leaderboard among friends with cosmetic rewards, reset every few months.

### 13.11 Measure real players
- A script reads stored fight records (emulator now, production later) and reports real win rates per boss, months to each tier and coin income, so tuning uses data, not only the pacing model.
- **Real training history:** Jackson may export his old workouts from Hevy (CSV). An import script would load them into the **emulator only** (never production, never committed) to check the stat and level curves against a real person's training.
- **First run (2026-10-30, `npx tsx scripts/hevy-pacing.ts <csv>...`, both of Jackson's accounts, 161 workouts over 10.6 months, no duplicates):**
  - Overall 3.1 counted workouts a week and 13.7 working sets each (model: 4 and 16). Two phases: Dec-Apr about 2.3 a week at 6-8 sets (a beginner ramp), May-Oct about 4.5 a week at 12-16 sets.
  - In the steady phase, body power grew about 34 a month, a little faster than the model (about 30), so the model's steady player matches real steady training.
  - **Exercises that beat their last session: 52%**, against the model's 15% of sets. With repMin 1 any extra rep counts, so real players progress far more often than assumed; the model under-counts points by about 8%.
  - Real split per workout: chest 1.7, back 3.1, shoulders 1.6, arms 3.5, legs 3.5, core 0.3 (model 3 / 3.5 / 2.5 / 3 / 3 / 1). Chest and shoulders run well under the model, so the per-stat boss minimums (`typicalStats`) ask more Chest than this player has.
  - After 10.6 months: level 9 and body power 239, against the model's level 16 and 328 (56% of its XP), almost all from the slow first five months.
  - **For the level curve (13.2):** early levels should come mostly from showing up (workout XP), not stat XP, since beginners log small workouts; tune the model's `progressedShare` up (about 0.45) before fitting the curve.

### 13.12 Notifications
- Web push for an installed web app: "Your weekly fight is ready", "The tower is open again", "1 workout from levelling up".

### 13.13 Step 1 (built 2026-10-30): levels 1-100, level rewards, stat points, energy, daily limit
- **Pacing model:** `PACING.progressedShare` is **0.45** (was 0.15), from the Hevy replay (13.11).
- **Curve:** reaching level L takes `round(22 × (L − 1)^1.5)` XP in all (`XP.curve`, `xpToReach`, `levelForXp`). Level 2 on the first workout, 5 in the first week, 12 at a month, 20 at 2 months, 39 at 6, 62 at a year, 82 at 18 months, 100 at about 24.5. Levels stop at 100 (`XP.maxLevel`); XP keeps counting and the bar keeps filling in steps the size of the last level.
- **Gates by month** (each opens when it did on the 1-35 scale): endless tower **25**, weekly tiers **1 / 35 / 55 / 70 / 100**, Boss Tower **55**, equip Epic **35**, Legendary **55**, Mythic **80**. With the corrected progressed share the Campaign (8.5 months, target 9) and Boss Tower floor 30 (28.4, target 30) now come a little early; left for the retune on real data (13.1 step 3).
- **Level rewards:** each new level pays 25 coins and 5 scrap, every 10th 250 and 50 (`LEVEL_REWARDS`), outside the daily coin cap, whether a claim or a quest claim reached it. `game/state.levelRewardsTo` records the highest level paid; claims store what they paid (`levelRewards`). About 5,000 coins and 1,000 scrap over two years. The backfill and `--rework` only mark replayed levels as paid.
- **Stat points:** one per level past 1, put into a muscle stat: +0.5% of that stat in fights, at most 30 a stat (`LEVEL_POINTS`), so spreading them is worth about +8% at level 100 and dumping them in one stat much less. Stored as `game/state.statPoints`. They count in fights and the Battle number only; boss minimums, the radar, Power, XP, quests and titles use earned stats. `POST /api/points` assigns (`add`, `expectedSpent`) or resets all for **500 coins** (`respec`), retry-safe by the spent total the client saw. No screen yet: the Battle screens (step 2) add it.
- **Fight energy:** a counted workout gives 3, up to 9; new players start with 3 (`ENERGY`, `game/state.energy`). A Campaign or endless tower request spends 1, an auto-climb included; the weekly boss and Boss Tower don't use it. The fight route returns `energy`.
- **Daily limit:** at most 2 counted workouts per workout day in the user's zone (`DAILY_WORKOUTS`, `game/state.countedDays`, kept 30 days). Counting by the workout's own day means a week of offline workouts syncing at once still counts. A third is "daily-limit": saved, no claim record, and the Rewards screen says so. Recompute and the backfill skip the same workouts.
- `e2e/seed.ts` sets XP with `xpToReach` (default level 80, everything equippable) and marks the seeded levels' rewards as paid.

### 13.14 Step 2 (built 2026-10-30): the Battle screens
- **Battle tab** (`src/app/(app)/battle/page.tsx`), on the existing routes. Header: class, energy and battle power. Without a class it shows the **class picker** (three cards: what it does, skill and ultimate; the first pick is free, confirmed). With one: a strip with **Points** (free count) and **Class** buttons, then one card per mode.
- **Fight cards** (`FightCard`): the next enemy (boss name, type, epithet), your power against its recommended power as a percentage, facts (tier locked for the week and wins, floor or stage, cooldowns), the **stat minimums** table (have / needed, met, short or injured), and the Fight button. Endless tower adds "Climb up to 5"; the Boss Tower adds a floor picker (cleared floors say "pays gold only"). A disabled button says why, in the server's own words: `battleView` dry-runs `runFight` on the same state. Weekly and Boss Tower fights confirm first.
- **Result screen** (`FightResultScreen`, full screen like Rewards): Victory/Defeat (a climb says "Climbed", "Climb stopped"), each round (foe, seconds, power against power, how it ended), coins, scrap and Mythic Cores, drops, duplicates turned to scrap, energy left, and a collapsed **log** per round with timestamped lines (`logLines`).
- **Loot reveal** (13.9): a drop settles into place once; Epic, Legendary and Mythic also send out one ring in their rarity color (`.rpg-reveal`, `.rpg-reveal-big` in `globals.css`; nothing loops; reduced motion turns both off). A guaranteed drop is labelled. This and the level-up block are the deliberate exceptions to 7.1.
- **Level-ups** show on the workout Rewards screen: "Level 12 reached", the coins and scrap paid, and the stat points to spend. The Rewards scrap line now counts quest scrap only.
- **Stat points sheet** (`PointsSheet`): plus and minus on a draft, "+1% in fights" per stat, Apply, and Reset all for 500 coins (confirmed).
- **Class sheet:** switch cost, the wait ("Next switch in ..."), and the same picker.
- **Class pick:** new accounts choose a class on the sign-up form, next to username and unit (Continue waits for it); it is saved right after the profile (`POST /api/class`, free), and if that call fails the Hero tab asks again. Existing accounts see "Pick your class to start fighting" on the Hero tab (a link to Battle) until they pick, and the Battle tab opens on the picker. `classCards()` lives in `heroClass.ts` so sign-up doesn't load the fight code. `e2e/onboarding.e2e.ts` covers it.
- Gear effects no longer read "(not active yet)": fights use them.
- Retried fights: the client keeps one request id per fight until it comes back, so a dropped connection returns the same stored fight.
- Not built (piece for later): fight history (the stored `fights/{id}` records have it), an animated replay, a skip-the-confirm setting.
- `e2e/battle.e2e.ts`: class pick from the Hero nudge, a Campaign fight to the result and log, energy and the once-a-day weekly boss, stat points draft/apply/reset, the class switch sheet; all at 390px with overflow and tap-target checks.

### 13.15 Icons (enemy stage 1 built 2026-10-30)
- **Today:** one flat line-art SVG per gear slot (`SlotIcon`: helmet, chestplate, gloves, leggings, boots, ring, necklace, belt, charm), tinted by rarity. Enemies and weapons have none.
- **Enemies (65 of them: 47 bosses, 15 Campaign enemies, 3 endless tower types):** hand-drawn SVG emblems in the same flat style, drawn as symbols rather than detailed creatures. Order: fallbacks first (one per boss type, three for the endless tower, a default), then the 5 chapter bosses and 12 weekly bosses, then the 30 tower bosses and 15 regular Campaign enemies. A contact-sheet page lets Jackson point at the ones to redo. Shown on fight cards, the result screen and the Boss Tower floor list.
- **Gear (with or after the item rework, 13.5):** Common to Epic share one icon per piece type per level band, so the look climbs with level (cloth and leather, then chain, then plate...) while rarity stays in the color. **Legendary and Mythic items each get their own unique icon.** The lookup is `item id → unique icon`, else `(piece type, level band) → shared icon`, else today's per-slot icon, so art can be added in batches. Weapons (sword, staff, shield) join as three more piece types. About 12 piece types × 5 bands = 60 shared icons, plus one per Legendary and Mythic item (about 30 today, many more once Legendary sets exist in every band). Draw after the item list settles.
- **Enemy icons, stage 1 (built):** `EnemyIcon` (`src/components/rpg/EnemyIcon.tsx`) draws 24×24 line art, one 1.2 stroke, in the muted text colour (no tile, per 7.1). Fights name enemies by display name, so the lookup is `enemyByName` (`src/lib/game/enemyIcons.ts`; endless names lose their "(floor N)") then **own art by id (`OWN_ART`) → kind fallback → default diamond**. Fallbacks: plain (crossed blades), brute (hammer), bleeder (drop), timer (hourglass), mixed (quartered shield), Sentinel (tower), Stalker (claw marks), Warden (horned helm), regular Campaign enemy (diamond). Own art so far: the **5 chapter bosses and 12 weekly bosses**; the 30 tower bosses and 15 Campaign enemies use fallbacks until their batch.
- Shown on every fight card (44px beside the title; the Boss Tower picker shows the picked floor's icon, since a native select can't hold SVG), and beside each round on the result screen. `ENEMIES` in `enemyIcons.ts` lists all 65 for tests and the **contact sheet**, `/dev/enemies` (404 in production builds): every icon with its name, id and kind. `e2e/battle.e2e.ts` checks the icons at 390px (visible, inside the screen, no overflow, tap targets).
