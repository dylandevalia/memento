import type { DriveConfig, GoogleCredentials } from "../../src/types";
import { getConfig, setConfig } from "../lib/db";
import { exchangeAuthCode } from "../lib/drive";

export const configRoutes = {
  "/api/config": {
    async GET(_req: Request): Promise<Response> {
      const body: DriveConfig = {
        rootFolderId: getConfig("rootFolderId"),
        rootFolderName: getConfig("rootFolderName"),
      };
      return Response.json(body);
    },
  },

  "/api/config/google": {
    /** Return public-safe Google credentials (no client secret). */
    async GET(_req: Request): Promise<Response> {
      const body: GoogleCredentials = {
        clientId: getConfig("googleClientId"),
        apiKey: getConfig("googleApiKey"),
        connected: Boolean(getConfig("googleRefreshToken")),
      };
      return Response.json(body);
    },

    /** Save Client ID, Client Secret (server-side only), and API Key. */
    async POST(req: Request): Promise<Response> {
      let body: { clientId: string; clientSecret: string; apiKey: string };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      if (
        !body.clientId?.trim() ||
        !body.clientSecret?.trim() ||
        !body.apiKey?.trim()
      ) {
        return Response.json(
          { error: "clientId, clientSecret, and apiKey are required" },
          { status: 400 },
        );
      }
      setConfig("googleClientId", body.clientId.trim());
      setConfig("googleClientSecret", body.clientSecret.trim());
      setConfig("googleApiKey", body.apiKey.trim());
      // Clear any existing refresh token when credentials change
      setConfig("googleRefreshToken", "");
      const result: GoogleCredentials = {
        clientId: body.clientId.trim(),
        apiKey: body.apiKey.trim(),
        connected: false,
      };
      return Response.json(result);
    },
  },

  "/api/config/google-auth": {
    /**
     * Exchange an OAuth authorization code for tokens.
     * Stores the refresh token in the DB and returns the access token
     * so the browser can immediately open the Drive Picker.
     */
    async POST(req: Request): Promise<Response> {
      let body: { code: string };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      if (!body.code?.trim()) {
        return Response.json({ error: "code is required" }, { status: 400 });
      }
      try {
        const result = await exchangeAuthCode(body.code.trim());
        return Response.json(result);
      } catch (err) {
        return Response.json(
          { error: (err as Error).message },
          { status: 500 },
        );
      }
    },
  },

  "/api/config/folder": {
    async POST(req: Request): Promise<Response> {
      let body: { folderId: string; folderName: string };
      try {
        body = (await req.json()) as { folderId: string; folderName: string };
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      if (!body.folderId?.trim() || !body.folderName?.trim()) {
        return Response.json(
          { error: "folderId and folderName are required" },
          { status: 400 },
        );
      }
      setConfig("rootFolderId", body.folderId.trim());
      setConfig("rootFolderName", body.folderName.trim());
      const result: DriveConfig = {
        rootFolderId: body.folderId.trim(),
        rootFolderName: body.folderName.trim(),
      };
      return Response.json(result);
    },
  },
};
