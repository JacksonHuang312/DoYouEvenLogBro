// Starts the Next.js dev server wired entirely to the local emulators, for clicking around with
// the account from `npm run seed:har`. Nothing here can reach the real Firebase project: it
// overrides the project id and every emulator host, and uses its own build folder and port so it
// can run next to a normal `npm run dev`.
//
//   npm run emulators        # one terminal
//   npm run seed:har         # once per emulator start
//   npm run dev:emu          # then open http://localhost:3200 and sign in (see seed-har.ts)
import { spawn } from "node:child_process";

const PROJECT = "demo-dyelb";
const env = {
  ...process.env,
  NEXT_PUBLIC_FIREBASE_EMULATOR: "1",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
  FIREBASE_ADMIN_PROJECT_ID: PROJECT,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT}.firebaseapp.com`,
  NEXT_DIST_DIR: ".next-emu",
};
const child = spawn("npx", ["next", "dev", "-p", "3200"], { env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
