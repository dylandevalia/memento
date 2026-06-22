import { getPasswordHash, setPasswordHash } from "../lib/db";
import {
  createSession,
  destroySession,
  getSessionToken,
  requireAuth,
} from "../lib/session";

export const authRoutes = {
  "/api/auth/status": {
    GET: (_req: Request): Response => {
      const hasPassword = getPasswordHash() !== null;
      return Response.json({ hasPassword });
    },
  },

  "/api/auth/login": {
    POST: async (req: Request): Promise<Response> => {
      const body = (await req.json()) as { password?: string };
      const { password } = body;

      if (!password) {
        return Response.json(
          { ok: false, error: "Password required" },
          { status: 400 },
        );
      }

      const hash = getPasswordHash();
      if (!hash) {
        return Response.json(
          { ok: false, error: "No password has been set" },
          { status: 401 },
        );
      }

      const ok = await Bun.password.verify(password, hash);
      if (!ok) {
        return Response.json(
          { ok: false, error: "Incorrect password" },
          { status: 401 },
        );
      }

      const sessionToken = createSession();
      return Response.json({ ok: true, sessionToken });
    },
  },

  "/api/auth/change-password": {
    POST: async (req: Request): Promise<Response> => {
      const body = (await req.json()) as {
        currentPassword?: string;
        newPassword?: string;
      };
      const { currentPassword, newPassword } = body;

      if (!newPassword || newPassword.length < 1) {
        return Response.json(
          { error: "New password is required" },
          { status: 400 },
        );
      }

      const existingHash = getPasswordHash();

      if (existingHash) {
        // Password already set — require an active session
        const authErr = requireAuth(req);
        if (authErr) return authErr;

        if (!currentPassword) {
          return Response.json(
            { error: "Current password is required" },
            { status: 400 },
          );
        }
        const ok = await Bun.password.verify(currentPassword, existingHash);
        if (!ok) {
          return Response.json(
            { error: "Current password is incorrect" },
            { status: 401 },
          );
        }
      }

      const newHash = await Bun.password.hash(newPassword);
      setPasswordHash(newHash);

      // Auto-issue a session on first-time setup so the user lands on /admin immediately
      const sessionToken = existingHash ? undefined : createSession();
      return Response.json({
        ok: true,
        ...(sessionToken ? { sessionToken } : {}),
      });
    },
  },

  "/api/auth/logout": {
    POST: (req: Request): Response => {
      const token = getSessionToken(req);
      if (token) destroySession(token);
      return new Response(null, { status: 204 });
    },
  },
};
