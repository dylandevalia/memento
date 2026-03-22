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
        // Tell browsers to cache the redirect for 1 hour
        return new Response(null, {
          status: 302,
          headers: {
            Location: url,
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (err) {
        return new Response((err as Error).message, { status: 502 });
      }
    },
  },
};
