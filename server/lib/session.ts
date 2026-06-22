import { deleteSession, hasSession, insertSession } from "./db";

/**
 * SQLite-backed session store for the admin portal.
 * Sessions survive server restarts and are purged after 90 days of inactivity.
 */

export function createSession(): string {
  const token = crypto.randomUUID();
  insertSession(token);
  return token;
}

export function destroySession(token: string): void {
  deleteSession(token);
}

export function getSessionToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

/** Returns a 401 Response if the request carries no valid session, otherwise null. */
export function requireAuth(req: Request): Response | null {
  const token = getSessionToken(req);
  if (!token || !hasSession(token)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
