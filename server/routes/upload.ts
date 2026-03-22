import type { UploadResponse } from "../../src/types";
import { getEventBySlug } from "../lib/db";
import { moveFileToBin, uploadFileToDrive } from "../lib/drive";

export const uploadRoutes = {
  "/api/upload/:token": {
    async POST(
      req: Request & { params: Record<string, string> },
    ): Promise<Response> {
      const token = req.params.token;
      if (!token) {
        return Response.json({ error: "Missing slug" }, { status: 400 });
      }
      const event = getEventBySlug(token);
      if (!event) {
        return Response.json({ error: "Event not found" }, { status: 404 });
      }
      if (event.expiresAt !== null && new Date(event.expiresAt) < new Date()) {
        return Response.json(
          { error: "This upload link has expired" },
          { status: 410 },
        );
      }

      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return Response.json(
          { error: "Invalid multipart form data" },
          { status: 400 },
        );
      }

      const files = formData.getAll("files") as File[];
      if (files.length === 0) {
        return Response.json({ error: "No files provided" }, { status: 400 });
      }

      const invalidFiles = files.filter(
        (f) => !f.type.startsWith("image/") && !f.type.startsWith("video/"),
      );
      if (invalidFiles.length > 0) {
        return Response.json(
          {
            error: `Only photos and videos are allowed. Rejected: ${invalidFiles.map((f) => f.name).join(", ")}`,
          },
          { status: 415 },
        );
      }

      const uploaded: { name: string; driveId: string }[] = [];
      const failed: { name: string; error: string }[] = [];

      for (const file of files) {
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const driveId = await uploadFileToDrive(
            file.name,
            file.type || "application/octet-stream",
            buffer,
            event.driveFolderId,
          );
          uploaded.push({ name: file.name, driveId });
        } catch (err) {
          failed.push({ name: file.name, error: (err as Error).message });
        }
      }

      if (uploaded.length === 0) {
        return Response.json(
          { error: `All uploads failed. First error: ${failed[0]?.error}` },
          { status: 502 },
        );
      }

      const body: UploadResponse = {
        uploaded: uploaded.length,
        files: uploaded,
      };
      return Response.json(body, { status: 201 });
    },
  },

  "/api/upload/:slug/:driveId": {
    async DELETE(
      req: Request & { params: Record<string, string> },
    ): Promise<Response> {
      const { slug, driveId } = req.params;
      if (!slug || !driveId) {
        return Response.json(
          { error: "Missing slug or driveId" },
          { status: 400 },
        );
      }
      const event = getEventBySlug(slug);
      if (!event) {
        return Response.json({ error: "Event not found" }, { status: 404 });
      }
      try {
        await moveFileToBin(driveId, event.driveFolderId);
        return new Response(null, { status: 204 });
      } catch (err) {
        return Response.json(
          { error: (err as Error).message },
          { status: 502 },
        );
      }
    },
  },
};
