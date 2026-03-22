import path from "node:path";
import { serve } from "bun";
import { authRoutes } from "./routes/auth";
import { configRoutes } from "./routes/config";
import { eventRoutes } from "./routes/events";
import { thumbnailRoutes } from "./routes/thumbnail";
import { uploadRoutes } from "./routes/upload";

const isDev = process.env.NODE_ENV !== "production";
const port = isDev ? 3001 : 3000;
const distDir = path.join(import.meta.dir, "../dist");

const corsHeaders = {
  "Access-Control-Allow-Origin": isDev ? "http://localhost:3000" : "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(corsHeaders)) res.headers.set(k, v);
  return res;
}

function addParams(
  req: Request,
  params: Record<string, string>,
): Request & { params: Record<string, string> } {
  return Object.assign(req, { params });
}

const server = serve({
  port,

  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method;

    // ── CORS preflight ──────────────────────────────────────────────
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── Auth routes ──────────────────────────────────────────────────
    if (pathname === "/api/auth/status") {
      if (method === "GET")
        return withCors(authRoutes["/api/auth/status"].GET(req));
    }

    if (pathname === "/api/auth/login") {
      if (method === "POST")
        return withCors(await authRoutes["/api/auth/login"].POST(req));
    }

    if (pathname === "/api/auth/change-password") {
      if (method === "POST")
        return withCors(
          await authRoutes["/api/auth/change-password"].POST(req),
        );
    }

    // ── Config routes ────────────────────────────────────────────────
    if (pathname === "/api/config") {
      if (method === "GET")
        return withCors(await configRoutes["/api/config"].GET(req));
    }

    if (pathname === "/api/config/google") {
      if (method === "GET")
        return withCors(await configRoutes["/api/config/google"].GET(req));
      if (method === "POST")
        return withCors(await configRoutes["/api/config/google"].POST(req));
    }

    if (pathname === "/api/config/google-auth") {
      if (method === "POST")
        return withCors(
          await configRoutes["/api/config/google-auth"].POST(req),
        );
    }

    if (pathname === "/api/config/folder") {
      if (method === "POST")
        return withCors(await configRoutes["/api/config/folder"].POST(req));
    }

    // ── Event routes ─────────────────────────────────────────────────
    if (pathname === "/api/events") {
      if (method === "GET")
        return withCors(await eventRoutes["/api/events"].GET(req));
      if (method === "POST")
        return withCors(await eventRoutes["/api/events"].POST(req));
    }

    // /api/events/:token/qr  (must come before /:id)
    const qrMatch = pathname.match(/^\/api\/events\/([^/]+)\/qr$/);
    if (qrMatch) {
      const token = qrMatch[1] ?? "";
      if (method === "GET")
        return withCors(
          await eventRoutes["/api/events/:token/qr"].GET(
            addParams(req, { token }),
          ),
        );
    }

    // /api/events/:token/validate  (must come before /:id)
    const validateMatch = pathname.match(/^\/api\/events\/([^/]+)\/validate$/);
    if (validateMatch) {
      const token = validateMatch[1] ?? "";
      if (method === "GET")
        return withCors(
          await eventRoutes["/api/events/:token/validate"].GET(
            addParams(req, { token }),
          ),
        );
    }

    // /api/events/:id
    const eventIdMatch = pathname.match(/^\/api\/events\/(\d+)$/);
    if (eventIdMatch) {
      const id = eventIdMatch[1] ?? "";
      if (method === "DELETE")
        return withCors(
          await eventRoutes["/api/events/:id"].DELETE(addParams(req, { id })),
        );
    }

    // ── Upload routes ────────────────────────────────────────────────
    const uploadMatch = pathname.match(/^\/api\/upload\/([^/]+)$/);
    if (uploadMatch) {
      const token = uploadMatch[1] ?? "";
      if (method === "POST")
        return withCors(
          await uploadRoutes["/api/upload/:token"].POST(
            addParams(req, { token }),
          ),
        );
    }

    // ── File delete routes ────────────────────────────────────────────
    const fileDeleteMatch = pathname.match(/^\/api\/upload\/([^/]+)\/([^/]+)$/);
    if (fileDeleteMatch) {
      const slug = fileDeleteMatch[1] ?? "";
      const driveId = fileDeleteMatch[2] ?? "";
      if (method === "DELETE")
        return withCors(
          await uploadRoutes["/api/upload/:slug/:driveId"].DELETE(
            addParams(req, { slug, driveId }),
          ),
        );
    }

    // ── Thumbnail routes ─────────────────────────────────────────────
    const thumbnailMatch = pathname.match(/^\/api\/thumbnail\/([^/]+)$/);
    if (thumbnailMatch) {
      const driveId = thumbnailMatch[1] ?? "";
      if (method === "GET")
        return withCors(
          await thumbnailRoutes["/api/thumbnail/:driveId"].GET(
            addParams(req, { driveId }),
          ),
        );
    }

    // ── Static files (production) / 404 (dev) ───────────────────────
    if (isDev) {
      return new Response("Not found", { status: 404 });
    }
    const file = Bun.file(path.join(distDir, pathname));
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file(path.join(distDir, "index.html")));
  },
});

console.log(`🚀 Server running at ${server.url}`);
