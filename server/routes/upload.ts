import type { UploadResponse } from "../../src/types";
import { getEventBySlug, recordUpload } from "../lib/db";
import { moveFileToBin, uploadFileToDrive } from "../lib/drive";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "../lib/rateLimit";

/** Upload at most this many files to Drive in parallel within a single batch request. */
const DRIVE_UPLOAD_CONCURRENCY = 5;

/**
 * Upload a batch of files to Drive with a bounded concurrency limit.
 * Returns arrays of succeeded and failed items.
 */
async function uploadBatch(
  files: File[],
  driveFolderId: string,
  uploaderName: string | null,
): Promise<{
  uploaded: { name: string; driveId: string }[];
  failed: { name: string; error: string }[];
}> {
  const uploaded: { name: string; driveId: string }[] = [];
  const failed: { name: string; error: string }[] = [];

  const queue = [...files];
  const active: Promise<void>[] = [];

  const processFile = async (file: File) => {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const driveId = await uploadFileToDrive(
        file.name,
        file.type || "application/octet-stream",
        buffer,
        driveFolderId,
        uploaderName || undefined,
      );
      uploaded.push({ name: file.name, driveId });
    } catch (err) {
      failed.push({ name: file.name, error: (err as Error).message });
    }
  };

  while (queue.length > 0 || active.length > 0) {
    while (active.length < DRIVE_UPLOAD_CONCURRENCY && queue.length > 0) {
      const file = queue.shift()!;
      const p: Promise<void> = processFile(file).then(() => {
        const idx = active.indexOf(p);
        if (idx > -1) active.splice(idx, 1);
      });
      active.push(p);
    }
    if (active.length > 0) await Promise.race(active);
  }

  return { uploaded, failed };
}

export const uploadRoutes = {
  "/api/upload/:slug": {
    async POST(
      req: Request & { params: Record<string, string> },
    ): Promise<Response> {
      // Rate limiting: 300 uploads per minute per IP
      const clientIp = getClientIp(req);
      console.log(`[Upload] Client IP: ${clientIp}`);

      try {
        const rateLimit = checkRateLimit(`upload:${clientIp}`, 300, 60000);
        console.log(`[Upload] Rate limit check:`, rateLimit);

        if (!rateLimit.allowed) {
          console.log(`[Upload] Rate limit exceeded for ${clientIp}`);
          return rateLimitResponse(rateLimit.resetTime);
        }
      } catch (error) {
        console.error(`[Upload] Rate limit check error:`, error);
        // Continue with upload if rate limit check fails
      }

      const slug = req.params.slug;
      if (!slug) {
        return Response.json({ error: "Missing slug" }, { status: 400 });
      }
      const event = getEventBySlug(slug);
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

      const validFiles = files.filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
      );

      const { uploaded, failed } = await uploadBatch(
        validFiles,
        event.driveFolderId,
        uploaderName,
      );

      // Record successful uploads in the database
      for (const file of uploaded) {
        recordUpload(event.id, file.driveId, file.name, uploaderName);
      }

      if (uploaded.length === 0) {
        return Response.json(
          {
            error: `All uploads failed. First error: ${failed[0]?.error}`,
          },
          { status: 502 },
        );
      }

      const body: UploadResponse = {
        uploaded: uploaded.length,
        files: uploaded,
        ...(failed.length > 0 && { failed }),
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
