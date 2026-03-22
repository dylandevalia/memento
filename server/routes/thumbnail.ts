import { getThumbnailUrl } from "../lib/drive";

export const thumbnailRoutes = {
  "/api/thumbnail/:driveId": {
    async GET(
      req: Request & { params: Record<string, string> },
    ): Promise<Response> {
      const { driveId } = req.params;
      if (!driveId) {
        return new Response("Missing driveId", { status: 400 });
      }
      try {
        const url = await getThumbnailUrl(driveId);
        if (!url) {
          return new Response("No thumbnail available", { status: 404 });
        }

        // Proxy the image bytes through our server so browsers never hit
        // Google's CDN directly — this prevents per-IP 429s from the client side.
        const upstream = await fetch(url);
        if (!upstream.ok) {
          return new Response("Upstream fetch failed", {
            status: upstream.status,
          });
        }

        const contentType =
          upstream.headers.get("content-type") ?? "image/jpeg";
        const body = await upstream.arrayBuffer();

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            // Clients cache for 24 h; CDN/proxy may cache for the same period
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      } catch (err) {
        return new Response((err as Error).message, { status: 502 });
      }
    },
  },
};
