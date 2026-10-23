import { defineConfig } from "@playwright/test";
import path from "node:path";

/*
 * End-to-end tests (see e2e/README.md). Everything here talks to the local Firebase emulators and
 * a throwaway dev server, never to the real project: the env below is set for the test workers
 * and for `next dev` alike, and seed.ts refuses to run unless the Firestore emulator is set.
 * Run with `npm run e2e`, which starts the emulators around this config.
 */

export const E2E_PORT = 3100;
export const E2E_PROJECT = "demo-dyelb";

// Same ports as firebase.json. Set at load time so the test workers (which import this file too)
// point the Admin SDK at the emulators.
const emulatorEnv = {
  NEXT_PUBLIC_FIREBASE_EMULATOR: "1",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: E2E_PROJECT,
  FIREBASE_ADMIN_PROJECT_ID: E2E_PROJECT,
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${E2E_PROJECT}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
};
Object.assign(process.env, emulatorEnv);

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.e2e.ts",
  outputDir: "./.output/results",
  reporter: [["list"], ["html", { outputFolder: "./.output/report", open: "never" }]],
  // One shared emulator and one test user: tests reseed that user, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    // Your installed Chrome, so no browser download is needed. E2E_CHANNEL=msedge uses Edge instead.
    channel: process.env.E2E_CHANNEL ?? "chrome",
    // The phone layout the app is designed for (390px).
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-US",
    timezoneId: "America/Toronto",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // A separate build dir (NEXT_DIST_DIR, see next.config.ts) so it never clashes with `npm run dev`.
    command: `npx next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    // The project root (the default would be this e2e/ folder).
    cwd: path.resolve(__dirname, ".."),
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...emulatorEnv, NEXT_DIST_DIR: ".next-e2e" },
  },
});
