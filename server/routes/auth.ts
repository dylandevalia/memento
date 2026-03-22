import { getPasswordHash, setPasswordHash } from "../lib/db";

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

      return Response.json({ ok: true });
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

      // If a password is already set, verify the current one first
      if (existingHash) {
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
      return Response.json({ ok: true });
    },
  },
};
