import type { UploadResponse } from "../../src/types";
import { getEventBySlug, recordUpload } from "../lib/db";
import { moveFileToBin, uploadFileToDrive } from "../lib/drive";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "../lib/rateLimit";

export const uploadRoutes = {
  "/api/upload/:token": {
    async POST(
      req: Request & { params: Record<string, string> },
    ): Promise<Response> {
      // Rate limiting: 50 uploads per minute per IP
      const clientIp = getClientIp(req);
      console.log(`[Upload] Client IP: ${clientIp}`);

      try {
        const rateLimit = checkRateLimit(`upload:${clientIp}`, 50, 60000);
        console.log(`[Upload] Rate limit check:`, rateLimit);

        if (!rateLimit.allowed) {
          console.log(`[Upload] Rate limit exceeded for ${clientIp}`);
          return rateLimitResponse(rateLimit.resetTime);
        }
      } catch (error) {
        console.error(`[Upload] Rate limit check error:`, error);
        // Continue with upload if rate limit check fails
      }

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

      // Extract optional uploader name from FormData
      const uploaderName = formData.get("uploaderName") as string | null;

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
            uploaderName || undefined,
          );
          uploaded.push({ name: file.name, driveId });

          // Record the upload in the database
          recordUpload(event.id, driveId, file.name, uploaderName);
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
