import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet, type JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, test } from "vitest";
import { verifyIdToken } from "./idToken";

const PROJECT = "demo-project";
const ISSUER = `https://securetoken.google.com/${PROJECT}`;
const now = () => Math.floor(Date.now() / 1000);

let keys: JWTVerifyGetKey;
let sign: (claims?: Record<string, unknown>, opts?: { exp?: number; alg?: string; kid?: string }) => Promise<string>;
let foreign: (claims?: Record<string, unknown>) => Promise<string>;

beforeAll(async () => {
  const google = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(google.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] });
  const token = (key: CryptoKey) => (claims: Record<string, unknown> = {}, { exp = now() + 3600, kid = "k1" } = {}) =>
    new SignJWT({ auth_time: now() - 60, ...claims })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer((claims.iss as string) ?? ISSUER)
      .setAudience((claims.aud as string) ?? PROJECT)
      .setSubject((claims.sub as string) ?? "user-1")
      .setIssuedAt(now() - 60)
      .setExpirationTime(exp)
      .sign(key);
  sign = token(google.privateKey);
  foreign = token(other.privateKey);
});

describe("verifyIdToken", () => {
  test("a token signed by Google's key for this project gives its user", async () => {
    expect(await verifyIdToken(await sign(), PROJECT, keys)).toBe("user-1");
    expect(await verifyIdToken(await sign({ sub: "abc123" }), PROJECT, keys)).toBe("abc123");
  });

  test("a token signed by anyone else is refused", async () => {
    await expect(verifyIdToken(await foreign(), PROJECT, keys)).rejects.toThrow();
  });

  test("a token for another project, or from another issuer, is refused", async () => {
    await expect(verifyIdToken(await sign({ aud: "other-project" }), PROJECT, keys)).rejects.toThrow();
    await expect(verifyIdToken(await sign({ iss: "https://securetoken.google.com/other-project" }), PROJECT, keys)).rejects.toThrow();
    await expect(verifyIdToken(await sign({ iss: "https://evil.example" }), PROJECT, keys)).rejects.toThrow();
    // This project's token doesn't work against another project's server either.
    await expect(verifyIdToken(await sign(), "other-project", keys)).rejects.toThrow();
  });

  test("an expired token is refused", async () => {
    await expect(verifyIdToken(await sign({}, { exp: now() - 60 }), PROJECT, keys)).rejects.toThrow();
  });

  test("an unsigned token (alg none) and garbage are refused", async () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64({ alg: "none", typ: "JWT" })}.${b64({ iss: ISSUER, aud: PROJECT, sub: "user-1", exp: now() + 3600, auth_time: now() - 60 })}.`;
    await expect(verifyIdToken(unsigned, PROJECT, keys)).rejects.toThrow();
    await expect(verifyIdToken("not-a-token", PROJECT, keys)).rejects.toThrow();
    await expect(verifyIdToken("", PROJECT, keys)).rejects.toThrow();
  });

  test("a token with no user, an over-long user, or a sign-in time in the future is refused", async () => {
    await expect(verifyIdToken(await sign({ sub: "x".repeat(129) }), PROJECT, keys)).rejects.toThrow();
    await expect(verifyIdToken(await sign({ auth_time: now() + 3600 }), PROJECT, keys)).rejects.toThrow();
    await expect(verifyIdToken(await sign({ auth_time: "yesterday" }), PROJECT, keys)).rejects.toThrow();
  });

  test("with no project id configured nothing verifies", async () => {
    await expect(verifyIdToken(await sign(), "", keys)).rejects.toThrow(/project id/);
  });
});
