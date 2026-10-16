import { z } from "zod";
import { adminAuth } from "./admin";

/** An error with an HTTP status, turned into a JSON response by apiRoute(). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The signed-in user's uid, from a Firebase ID token sent as `Authorization: Bearer <token>`. */
export async function requireUser(request: Request): Promise<string> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Missing ID token");
  try {
    return (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    throw new HttpError(401, "Invalid or expired ID token");
  }
}

/** The JSON request body, validated with `schema`. */
export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new HttpError(400, z.prettifyError(parsed.error));
  return parsed.data;
}

/** Wraps a route handler: its return value becomes the JSON response, errors become { error }. */
export function apiRoute(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request) => {
    try {
      return Response.json(await handler(request));
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
      console.error(err);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}
