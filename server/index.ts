import { serve } from "bun";
import path from "path";
import { helloRoutes } from "./routes/hello";

const isDev = process.env.NODE_ENV !== "production";
const port = isDev ? 3001 : 3000;
const distDir = path.join(import.meta.dir, "../dist");

const server = serve({
  port,
  routes: {
    ...helloRoutes,
  },

  // In production, serve Vite's built output and fall back to index.html for SPA routing.
  async fetch(req) {
    if (isDev) {
      return new Response("Not found", { status: 404 });
    }
    const url = new URL(req.url);
    const file = Bun.file(path.join(distDir, url.pathname));
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file(path.join(distDir, "index.html")));
  },
});

console.log(`🚀 Server running at ${server.url}`);
