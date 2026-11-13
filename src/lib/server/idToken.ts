import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/*
 * Checks a Firebase ID token without the Admin SDK's auth module, the way Firebase documents for
 * third-party JWT libraries (https://firebase.google.com/docs/auth/admin/verify-id-tokens): the
 * token must be signed (RS256) by one of Google's securetoken keys, be issued for this project,
 * not be expired, and name a user.
 *
 * Why not `firebase-admin/auth`: it loads `jwks-rsa`, which `require()`s the ES-module-only `jose`.
 * Vercel's Node runtime refuses that (ERR_REQUIRE_ESM), so every API route answered 500 there.
 * Importing `jose` directly works everywhere.
 */

const GOOGLE_KEYS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let googleKeys: JWTVerifyGetKey | undefined;
/** Google's public signing keys, fetched once and refreshed by `jose` when a new key id shows up. */
const remoteKeys = (): JWTVerifyGetKey => (googleKeys ??= createRemoteJWKSet(new URL(GOOGLE_KEYS)));

/**
 * The uid the token was issued to. Throws if the token is not a valid, unexpired ID token for
 * `projectId`. `keys` is only passed by tests.
 */
export async function verifyIdToken(token: string, projectId: string, keys: JWTVerifyGetKey = remoteKeys()): Promise<string> {
  if (!projectId) throw new Error("No Firebase project id to verify ID tokens against");
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ["RS256"],
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    // A few seconds for clocks that disagree.
    clockTolerance: 5,
  });
  const uid = payload.sub;
  if (typeof uid !== "string" || uid.length === 0 || uid.length > 128) throw new Error("ID token has no user");
  // Signed in at some point in the past, as Firebase requires.
  if (typeof payload.auth_time !== "number" || payload.auth_time > Date.now() / 1000 + 5) throw new Error("ID token has a bad auth_time");
  return uid;
}
