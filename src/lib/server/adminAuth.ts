import { getAuth } from "firebase-admin/auth";
import { adminApp } from "./admin";

/**
 * The Admin SDK's auth module: creating test users (the e2e seeds) and checking ID tokens against
 * the Auth emulator. Kept out of `admin.ts` on purpose: loading `firebase-admin/auth` fails on
 * Vercel's Node runtime (see idToken.ts), so nothing a deployed route loads may import this file
 * except through a dynamic import in emulator mode.
 */
export const adminAuth = () => getAuth(adminApp());
