import type { UploadResponse } from "../../src/types";
import { getEventBySlug, recordUpload } from "../lib/db";
import {
  createResumableUploadSession,
  moveFileToBin,
  uploadFileToDrive,
} from "../lib/drive";
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

  /**
   * PUT /api/upload/:slug/stream
   * Headers: Content-Type, Content-Length, X-File-Name, X-Uploader-Name (opt)
   * Body: raw file bytes
   *
   * Thin streaming proxy: creates a Drive resumable upload session, then
   * pipes req.body straight through to Drive without buffering the file in
   * server memory. Returns UploadResponse once Drive confirms the write.
   *
   * This avoids the CORS restriction that prevents browsers from reading
   * Drive upload responses directly, while still keeping the actual byte
   * transfer as a single hop (client XHR progress events fire against the
   * real transfer to our server, which immediately forwards to Drive).
   */
  "/api/upload/:slug/stream": {
    async PUT(
      req: Request & { params: Record<string, string> },
    ): Promise<Response> {
      const { slug } = req.params;
      if (!slug)
        return Response.json({ error: "Missing slug" }, { status: 400 });

      const event = getEventBySlug(slug);
      if (!event)
        return Response.json({ error: "Event not found" }, { status: 404 });
      if (event.expiresAt !== null && new Date(event.expiresAt) < new Date())
        return Response.json(
          { error: "This upload link has expired" },
          { status: 410 },
        );

      const clientIp = getClientIp(req);
      try {
        const rateLimit = checkRateLimit(`upload:${clientIp}`, 300, 60000);
        if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetTime);
      } catch {
        // Continue if rate-limit check itself errors
      }

      // File metadata comes from request headers, not multipart
      const mimeType =
        req.headers.get("Content-Type") || "application/octet-stream";
      const rawName = req.headers.get("X-File-Name");
      const fileName = rawName ? decodeURIComponent(rawName) : "upload";
      const fileSize = parseInt(req.headers.get("Content-Length") || "0", 10);
      const uploaderName = req.headers.get("X-Uploader-Name") || null;

      if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/"))
        return Response.json(
          { error: "Only photos and videos are allowed" },
          { status: 415 },
        );

      if (!req.body)
        return Response.json(
          { error: "Request body is empty" },
          { status: 400 },
        );

      try {
        // Create a Drive resumable session. The client has already started
        // sending bytes; they sit in the OS TCP buffer until we forward them.
        const uploadUri = await createResumableUploadSession(
          fileName,
          mimeType,
          fileSize,
          event.driveFolderId,
          uploaderName ?? undefined,
        );

        // Pipe req.body straight to Drive — no arrayBuffer(), no buffering.
        const driveRes = await fetch(uploadUri, {
          method: "PUT",
          // @ts-expect-error duplex is required for streaming bodies in some
          // fetch implementations; Bun supports it but typedefs may omit it.
          duplex: "half",
          headers: {
            "Content-Type": mimeType,
            ...(fileSize > 0 && {
              "Content-Length": String(fileSize),
            }),
          },
          body: req.body,
        });

        if (!driveRes.ok) {
          const txt = await driveRes.text();
          throw new Error(
            `Drive rejected the upload: ${driveRes.status} ${txt}`,
          );
        }

        const driveData = (await driveRes.json()) as { id?: string };
        if (!driveData.id) throw new Error("Drive did not return a file ID");

        recordUpload(event.id, driveData.id, fileName, uploaderName);

        const body: UploadResponse = {
          uploaded: 1,
          files: [{ name: fileName, driveId: driveData.id }],
        };
        return Response.json(body, { status: 201 });
      } catch (err) {
        return Response.json(
          { error: (err as Error).message },
          { status: 502 },
        );
      }
    },
  },

  /**
   * POST /api/upload/:slug/session
   * Body: { fileName, mimeType, fileSize, uploaderName? }
   *
   * Validates the event and creates a Drive resumable upload session.
   * Returns { uploadUri } — a pre-authenticated URL the client can PUT
   * the file bytes to directly, bypassing the server entirely.
   */
  "/api/upload/:slug/session": {
    async POST(
      req: Request & { params: Record<string, string> },
    ): Promise<Response> {
      const { slug } = req.params;
      if (!slug)
        return Response.json({ error: "Missing slug" }, { status: 400 });

      const event = getEventBySlug(slug);
      if (!event)
        return Response.json({ error: "Event not found" }, { status: 404 });
      if (event.expiresAt !== null && new Date(event.expiresAt) < new Date())
        return Response.json(
          { error: "This upload link has expired" },
          { status: 410 },
        );

      // Rate-limit session creation the same as direct uploads
      const clientIp = getClientIp(req);
      try {
        const rateLimit = checkRateLimit(`upload:${clientIp}`, 300, 60000);
        if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetTime);
      } catch {
        // Continue if rate-limit check itself errors
      }

      let body: {
        fileName: string;
        mimeType: string;
        fileSize: number;
        uploaderName?: string;
      };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const { fileName, mimeType, fileSize, uploaderName } = body;
      if (!fileName || !mimeType || !fileSize) {
        return Response.json(
          {
            error: "Missing required fields: fileName, mimeType, fileSize",
          },
          { status: 400 },
        );
      }
      if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
        return Response.json(
          { error: "Only photos and videos are allowed" },
          { status: 415 },
        );
      }

      try {
        const uploadUri = await createResumableUploadSession(
          fileName,
          mimeType,
          fileSize,
          event.driveFolderId,
          uploaderName,
        );
        return Response.json({ uploadUri });
      } catch (err) {
        return Response.json(
          { error: (err as Error).message },
          { status: 502 },
        );
      }
    },
  },

  /**
   * POST /api/upload/:slug/confirm
   * Body: { driveId, fileName, uploaderName? }
   *
   * Called by the client after a successful direct Drive upload to record
   * the upload in the database. Not rate-limited — it is a lightweight DB
   * write and the file is already on Drive by this point.
   */
  "/api/upload/:slug/confirm": {
    async POST(
      req: Request & { params: Record<string, string> },
    ): Promise<Response> {
      const { slug } = req.params;
      if (!slug)
        return Response.json({ error: "Missing slug" }, { status: 400 });

      const event = getEventBySlug(slug);
      if (!event)
        return Response.json({ error: "Event not found" }, { status: 404 });

      let body: {
        driveId: string;
        fileName: string;
        uploaderName?: string;
      };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const { driveId, fileName, uploaderName } = body;
      if (!driveId || !fileName) {
        return Response.json(
          { error: "Missing required fields: driveId, fileName" },
          { status: 400 },
        );
      }

      try {
        recordUpload(event.id, driveId, fileName, uploaderName ?? null);
        return Response.json({ driveId }, { status: 201 });
      } catch (err) {
        return Response.json(
          { error: (err as Error).message },
          { status: 502 },
        );
      }
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
