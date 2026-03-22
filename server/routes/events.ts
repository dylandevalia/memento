import type {
  CreateEventPayload,
  CreateEventResponse,
  ValidateTokenResponse,
} from "../../src/types";
import {
  createEvent,
  deleteEvent,
  getConfig,
  getEventBySlug,
  listEvents,
  slugExists,
} from "../lib/db";
import { createDriveFolder } from "../lib/drive";
import { generateQrDataUrl } from "../lib/qr";

function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

/** Convert an event name to a URL-safe slug, e.g. "My Party!" → "my-party" */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/** Return a slug that is unique in the DB, appending -2, -3, … as needed */
function uniqueSlug(base: string): string {
  let slug = base;
  let n = 2;
  while (slugExists(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export const eventRoutes = {
  "/api/events": {
    /** List all events */
    async GET(_req: Request): Promise<Response> {
      const events = listEvents();
      return Response.json(events);
    },

    /** Create a new event */
    async POST(req: Request): Promise<Response> {
      const rootFolderId = getConfig("rootFolderId");
      if (!rootFolderId) {
        return Response.json(
          {
            error:
              "No Drive folder configured. Use the Admin page to connect Google Drive.",
          },
          { status: 500 },
        );
      }

      let body: CreateEventPayload;
      try {
        body = (await req.json()) as CreateEventPayload;
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      if (!body.name?.trim()) {
        return Response.json(
          { error: "Event name is required" },
          { status: 400 },
        );
      }
      const expiresAt = body.expiresAt ?? null;
      if (expiresAt !== null) {
        if (Number.isNaN(Date.parse(expiresAt))) {
          return Response.json(
            { error: "expiresAt must be a valid date" },
            { status: 400 },
          );
        }
        if (new Date(expiresAt) <= new Date()) {
          return Response.json(
            { error: "expiresAt must be in the future" },
            { status: 400 },
          );
        }
      }

      const token = crypto.randomUUID();
      const slug = uniqueSlug(slugify(body.name.trim()));

      // Create a Google Drive sub-folder for this event
      let driveFolderId: string;
      try {
        driveFolderId = await createDriveFolder(body.name.trim(), rootFolderId);
      } catch (err) {
        return Response.json(
          { error: `Failed to create Drive folder: ${(err as Error).message}` },
          { status: 502 },
        );
      }

      const event = createEvent(
        body.name.trim(),
        slug,
        token,
        driveFolderId,
        expiresAt,
      );

      const uploadUrl = `${getBaseUrl(req)}/upload/${slug}`;
      let qrCodeDataUrl: string;
      try {
        qrCodeDataUrl = await generateQrDataUrl(uploadUrl);
      } catch (err) {
        return Response.json(
          { error: `Failed to generate QR code: ${(err as Error).message}` },
          { status: 500 },
        );
      }

      const response: CreateEventResponse = { event, qrCodeDataUrl, uploadUrl };
      return Response.json(response, { status: 201 });
    },
  },

  "/api/events/:id": {
    /** Delete an event */
    async DELETE(
      req: Request & { params: Record<string, string> },
    ): Promise<Response> {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
        return Response.json({ error: "Invalid event id" }, { status: 400 });
      }
      deleteEvent(id);
      return new Response(null, { status: 204 });
    },
  },

  "/api/events/:token/validate": {
    /** Validate an event by its slug */
    async GET(
      req: Request & { params: Record<string, string> },
    ): Promise<Response> {
      const token = req.params.token;
      if (!token) {
        return Response.json({ error: "Missing slug" }, { status: 400 });
      }
      const event = getEventBySlug(token);
      if (!event) {
        const body: ValidateTokenResponse = {
          valid: false,
          error: "Event not found",
        };
        return Response.json(body, { status: 404 });
      }
      if (event.expiresAt !== null && new Date(event.expiresAt) < new Date()) {
        const body: ValidateTokenResponse = {
          valid: false,
          error: "This link has expired",
        };
        return Response.json(body, { status: 410 });
      }
      const body: ValidateTokenResponse = {
        valid: true,
        event: { id: event.id, name: event.name, expiresAt: event.expiresAt },
      };
      return Response.json(body);
    },
  },
};
