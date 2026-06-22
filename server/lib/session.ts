/** In-memory session store for the admin portal. */
const sessions = new Set<string>();

export function createSession(): string {
  const token = crypto.randomUUID();
  sessions.add(token);
  return token;
}

export function destroySession(token: string): void {
  sessions.delete(token);
}

export function getSessionToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

/** Returns a 401 Response if the request carries no valid session, otherwise null. */
export function requireAuth(req: Request): Response | null {
  const token = getSessionToken(req);
  if (!token || !sessions.has(token)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
