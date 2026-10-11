# Do You Even Log, Bro?

A free, Hevy-style workout tracker for the web. Next.js + Firebase, deployed on Vercel.

## Setup

1. **Firebase project** at [console.firebase.google.com](https://console.firebase.google.com):
   - Add a **Web app** and copy its config.
   - **Authentication → Sign-in method**: enable **Google**.
   - **Firestore Database**: create it (production mode).
2. **Env vars**: copy `.env.example` to `.env.local` and fill in the config values.
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

- Import the repo in Vercel and add the same `NEXT_PUBLIC_FIREBASE_*` env vars.
- In Firebase **Authentication → Settings → Authorized domains**, add your `*.vercel.app` domain (and any custom domain), or Google sign-in will fail there.

## Data model

| Path | Contents |
| --- | --- |
| `users/{uid}` | Profile: username, `usernameChangedAt`, display name, unit (`kg`/`lb`), `isPrivate` |
| `usernames/{handle}` | `{ uid }`, written only alongside the profile so handles are unique |
| `users/{uid}/workouts/{id}` | Finished workout: exercises → sets (`type`, `weightKg`, `reps`) |
| `users/{uid}/routines/{id}` | Saved workout templates: exercises with set count and rest time |
| `users/{uid}/customExercises/{id}` | User-created exercises (ids start with `c_`), with an optional 192px JPEG photo stored inline as `imageData` |

Usernames can be changed once every 7 days. The change is one batch that claims the new handle,
releases the old one and sets `usernameChangedAt` to server time; `firestore.rules` enforces all of it.

Weights are always stored in kg and converted for display. The in-progress workout lives in
`localStorage` until you tap Finish, so a refresh or closed tab never loses it. Firestore's offline
cache queues saves when the gym has no signal.

The built-in exercise library (`src/data/exercises.json`) comes from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain), and exercise thumbnails load from its images via jsDelivr. Regenerate it with
`node scripts/build-exercises.mjs`.

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
4. Follows, feed, comments, photos
