import { getThumbnailData } from "../lib/drive";

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
        const thumbnail = await getThumbnailData(driveId);
        if (!thumbnail) {
          return new Response("No thumbnail available", { status: 404 });
        }

        return new Response(new Uint8Array(thumbnail.data), {
          status: 200,
          headers: {
            "Content-Type": thumbnail.contentType,
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
