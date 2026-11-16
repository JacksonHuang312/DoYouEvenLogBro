import type { APIRequestContext } from "@playwright/test";
import { RIVAL } from "./seed";

export type Json = { error?: string } & Record<string, unknown>;

/** Signs the rival in through the Auth emulator and returns a caller for the game routes as them. */
export async function rivalApi(request: APIRequestContext) {
  const res = await request.post("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator", {
    data: { email: RIVAL.email, password: RIVAL.password, returnSecureToken: true },
  });
  const token = ((await res.json()) as { idToken: string }).idToken;
  return async (path: string, body: Record<string, unknown>) => {
    const r = await request.post(path, { data: body, headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status(), json: (await r.json()) as Json };
  };
}
