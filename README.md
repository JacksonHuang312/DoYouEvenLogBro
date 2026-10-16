# Do You Even Log Bro?

A free, Hevy-style workout tracker for the web. Next.js + Firebase, deployed on Vercel.

## Setup

1. **Firebase project** at [console.firebase.google.com](https://console.firebase.google.com):
   - Add a **Web app** and copy its config.
   - **Authentication → Sign-in method**: enable **Google** and **Email/Password** (username +
     password accounts use Email/Password under the hood; see `src/lib/accounts.ts`).
   - **Firestore Database**: create it (production mode).
2. **Env vars**: copy `.env.example` to `.env.local` and fill in the config values. The game's API
   routes (`/api/claim`, `/api/recompute`) also need the `FIREBASE_ADMIN_*` service-account values
   (server only, never committed; see `.env.example`).
3. **Rules and indexes**: deploy them with the Firebase CLI:
   ```sh
   npx firebase-tools login
   npx firebase-tools use --add          # pick your project
   npx firebase-tools deploy --only firestore
   ```
4. **Run it**:
   ```sh
   npm install
   npm run dev
   ```

## Deploying to Vercel

- Import the repo in Vercel and add the same `NEXT_PUBLIC_FIREBASE_*` env vars, plus the
  `FIREBASE_ADMIN_*` ones. `firebase-admin` needs Node.js 22 or newer.
- In Firebase **Authentication → Settings → Authorized domains**, add your `*.vercel.app` domain (and any custom domain), or Google sign-in will fail there.

## Data model

| Path | Contents |
| --- | --- |
| `users/{uid}` | Profile: username, `usernameChangedAt`, display name, unit (`kg`/`lb`), `isPrivate` |
| `usernames/{handle}` | `{ uid, loginEmail? }`, written only alongside the profile so handles are unique. `loginEmail` is a username + password account's hidden sign-in address (never emailed); signing in looks it up by handle |
| `users/{uid}/workouts/{id}` | Finished workout: exercises → sets (`type`, `weightKg`, `reps`) |
| `users/{uid}/workouts/{id}/likes/{likerUid}` | One doc per like; counts come from server-side aggregation |
| `users/{uid}/workouts/{id}/comments/{id}` | Comments with the author's uid/username (checked by the rules) |
| `users/{uid}/following/{targetUid}` | Who `uid` follows. Always written and deleted in the same batch as its mirror below |
| `users/{uid}/followers/{followerUid}` | Who follows `uid` (the mirror). Counts come from server-side aggregation |
| `users/{uid}/followRequests/{requesterUid}` | Pending requests to follow a private account; the owner accepts (writing both follow docs) or declines |
| `users/{uid}/routines/{id}` | Saved workout templates: exercises with set count and rest time |
| `users/{uid}/customExercises/{id}` | User-created exercises (ids start with `c_`), with an optional 192px JPEG photo stored inline as `imageData`. `muscle` is one of the 17 sub-muscles in `src/lib/game/config.ts` |
| `users/{uid}/game/state`, `game/muscles` | RPG state (coins, XP, level, calibration) and per-sub-muscle facts (1RM estimates, last trained, weeks trained). Server-written only |
| `users/{uid}/claims/{workoutId}` | What claiming a workout paid; makes `/api/claim` idempotent. Server-written only |
| `users/{uid}/snapshots/{weekId}` | Weekly stat snapshot (week id = its Sunday's date). Server-written only |

The RPG layer is designed in `GAME_DESIGN.md`. Game rules are pure functions in `src/lib/game/`
(tunables in `config.ts`); rewards are granted only by API routes using `firebase-admin`. After a
workout saves, the client queues `POST /api/claim`; after an edit or delete, `POST /api/recompute`
(see `src/lib/gameSync.ts`). Accounts from before the RPG are set up once with
`npm run backfill` (run it before deploying the rules; `-- --dry-run` to preview).

Each workout's page, `/w/{uid}/{workoutId}`, is also its share link. Anyone can open it, signed in
or not, unless the owner's account is private. Signed-in users can like and comment.

Following works like Hevy: search people by username at `/search`, see anyone's profile at `/u/{uid}`,
and follow them. Public accounts can be followed straight away; private accounts get a follow request,
and only the owner and approved followers can see their workouts. The home feed merges your workouts
with everyone you follow, newest first (one live query per person; see `useFeed` in `src/lib/follows.ts`).

Usernames can be changed once every 7 days. The change is one batch that claims the new handle,
releases the old one and sets `usernameChangedAt` to server time; `firestore.rules` enforces all of it.

Weights are always stored in kg and converted for display. The in-progress workout lives in
`localStorage` until you tap Finish, so a refresh or closed tab never loses it. Firestore's offline
cache queues saves when the gym has no signal.

The built-in exercise library (`src/data/exercises.json`) comes from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain), and exercise thumbnails load from its images via jsDelivr. Regenerate it with
`node scripts/build-exercises.mjs`.

## Local development with emulators

Run the app against local Firebase emulators instead of your real project:

```sh
npm run emulators                    # terminal 1: Firestore + Auth emulators (needs Java)
node scripts/seed-emulator.mjs       # once: users alice@test.dev / bob@test.dev, password "password123"
NEXT_PUBLIC_FIREBASE_EMULATOR=1 NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-dyelb npm run dev
```

With the emulator flag, `window.__emulatorSignIn(email, password)` signs in as a seeded user from
the browser console (Google sign-in isn't available against the emulator).

## Unit tests

```sh
npm test              # Vitest: the game logic in src/lib/game/
```

## Testing the security rules

The rules tests run against the Firestore emulator, which needs Java (11+).

```sh
npm run emulators     # terminal 1, leave it running
npm run test:rules    # terminal 2, rerun after editing firestore.rules
```

`npm run test:rules:ci` starts and stops the emulator in one command (good for CI). On Windows the
emulator's Java process can survive it and block port 8080 next time; end that `java.exe` if so.

## Roadmap

1. ✅ Auth, usernames, exercise library, workout logger (set types, rest timer), history, units
2. ✅ Routines, weekly activity chart · PR trophies, per-exercise progress charts
3. Account deletion (Admin SDK route), privacy enforcement
4. ✅ Likes, comments, share links · follows, feed of people you follow, workout photos
