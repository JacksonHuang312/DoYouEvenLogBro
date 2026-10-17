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

- **Slots:** helmet, chestplate, gloves, leggings, boots.
- **Rarity ladder:** Common → Uncommon → Rare → Epic → Legendary → Mythic.
- **Named vs unnamed:** items that *start* at Legendary or Mythic are **named**. Everything that starts below (Common–Epic) is **unnamed**.
- **Unnamed gear** can climb all the way to Legendary (Epic → Legendary), but stops there. It never reaches Mythic.
- **Named gear** starts at Legendary or Mythic. Native Legendary can climb to Mythic (requires boss-only materials).
- **Ascended vs native:** an Epic upgraded to Legendary ("ascended") is always worse than a native Legendary: about **85%** of native stats at +0 and about **92%** at +2 (**tunable**), so a maxed ascended item still loses to a fresh native one. Only named gear gets unique set bonuses and abilities.
- **Upgrades:** +0 → +1 → +2 → next rarity at +0. Costs coins + salvage. **Upgrades never fail.**
- **Level requirement to equip** by rarity **(tunable: Epic 8, Legendary 15, Mythic 25)**.
- **Sets:** bonuses at 3 and 5 pieces.
- **Shop:** weekly rotating stock, deliberately pricey. Sells **Common through Epic only**. Legendary and Mythic are never sold.
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
| `users/{uid}/inventory/{itemId}` | owned items: base item id, origin rarity (tier it started at), current rarity, upgrade level, named flag (true if origin is Legendary/Mythic) |
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
3. **Rewards + scheduling + quests** — Rewards screen, scheduled workouts, weekly quests, pause mode.
4. **Items** — inventory, shop, upgrades, sets, titles.
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
- XP: 20 per workout, plus 10 per power point above the user's previous peak power. The peak rule means regaining decayed stats never pays twice. No stat XP during calibration. 500 XP per level.
- Backfill computes stats and XP from history but does **not** replay coins. Each existing user gets a flat 500-coin welcome bonus instead.
- Recompute (after a workout edit or delete) rebuilds muscle facts and snapshots without touching coins, XP or claim records. It only ever lowers `peakPower`, to the highest power the corrected history reached, so fixing a typo doesn't block future XP.

**Stat math**
- Epley estimate caps reps at 15; sets over 600 kg or 100 reps are ignored; workouts starting more than 24 h in the future are rejected.
- Bodyweight exercises with no weight logged count as bodyweight × 0.65; with added weight, bodyweight × 0.65 + the added weight.
- Missing bodyweight defaults to 75 kg; unknown sex averages the male and female standards. No onboarding prompts yet.
- Decay: after 7 days untrained, the strength part loses 1% per day, down to a floor of 50%.
- Calibration starts at the first counted workout and ends after 14 days or 6 workouts. During it, shown stats are population averages (30 per sub-muscle) while real numbers are stored underneath.
- Weeks start Sunday; the week id is that Sunday's date (e.g. 2026-10-11). Snapshots are written at claim time.
- Workouts under 4 working sets get no claim record, so they can still be claimed if later edited up to 4+ sets.
- Free-text custom-exercise muscles are mapped to the closest of the 17 values (alias table first, then nearest spelling); the backfill logs guesses for review.

**UI (Phase 2)**
- The Friends feed stays at /home, reachable from the avatar menu ("Friends feed"). The avatar menu also holds Profile, Find friends, Calendar, Follow requests (only when pending, with a dot on the avatar), Settings and Sign out.
- New screens and the new nav use only the fixed 7.1 palette and ignore per-user themes; old screens keep their themes until Phase 8.
- The Hero screen shows a loading skeleton until Firestore answers, so established users never flash "Calibrating…".

**Power multiplier**
- Legs and Back count **1.2x in Power only** (largest muscle groups by mass). The six radar stats stay unscaled. All other stats 1.0x. Value lives in `config.ts`. Implemented in Phase 5.

**Starting economy values (tune after ~2 weeks of real use; all in `config.ts`)**
- Income at 4 workouts/week: about 300 coins from workouts, about 450-500 with quests and boss wins.
- Shop prices: Common 150, Uncommon 450, Rare 1,000, Epic 2,500. Weekly stock of about 6 items, each marked up about 25%.
- Legendary and Mythic are not sold (boss drops only).

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

---

## 12. Balance rules (agreed after review)

**Anti-abuse (soft, not blocking)**
- Bodyweight changes of more than 5% from the last entry, and any single claim that raises a stat by more than 8 points **(tunable)**, show a non-blocking "Does this look right?" notice with the sets that caused it and an Edit button. Editing triggers the existing recompute. No hard caps.
- Pity: guaranteed Legendary after **6** first-clear boss kills without one **(tunable)**. Mythic has its own longer pity.

**Power stacking**
- Gear and titles affect battle power only. The radar shows raw stats.
- All percentage bonuses (titles, sets, class) share one additive bucket capped at **+25%**.
- Gear's share of total power is capped at 30% **in the formula**: `gear ≤ 0.3 / 0.7 × body power`.

**Economy**
- Sell price is 25% of buy price. Duplicate boss drops convert to salvage materials, not coins.
- Cosmetics (hero frames, banners, avatar items) are a coin sink, cosmetic only, added after the main phases.

**Stats have no cap.** They keep growing past 100; the radar axis scales to the highest stat. Verify `computeStats` and the radar don't clamp at 100.

**Gear stats (recommended starting values, tunable)**
- Power per piece: Common 3, Uncommon 6, Rare 10, Epic 15, Legendary 22, Mythic 32. Each +step adds 4% of the piece's base.
- Full-set totals: Epic 75, Legendary 110, Mythic 160. A full Mythic set only counts fully at an average stat of roughly 70+, so gear can't carry a weak lifter.
- Set bonus: 3 pieces +8% gear power, 5 pieces +20%. Named sets also get a unique effect.
- Slots feed combat attributes (70% primary / 30% secondary): Helmet HP/DEF, Chestplate DEF/HP, Gloves ATK/HP, Leggings HP/ATK, Boots ATK/DEF.

**Classes must matter in fights.** Bosses need a mechanic that rewards a tank and a healer (e.g. a damage type only DEF counters, a damage-over-time only healing offsets). Otherwise everyone picks Striker.

**Check at the start of Phase 3 (ask Claude Code to confirm against `config.ts` and the code)**
1. Is there a rep cap in the Epley estimate? If not, add cap 12.
2. Do `computeStats`, `displayStats` or the radar clamp stats at 100? If so, remove it.
3. Is workout XP limited by the 12-hour rule? If not, add it.
4. Are the level gates still 20/35/50 anywhere in config? Change to 8/15/25.
