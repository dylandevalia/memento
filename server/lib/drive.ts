import { Readable } from "node:stream";
import { google } from "googleapis";
import {
  getCachedThumbnail,
  getConfig,
  setCachedThumbnail,
  setConfig,
} from "./db";

/**
 * Build a Drive client using the OAuth2 refresh token stored in the DB.
 * Throws a descriptive error if the admin hasn't connected Google yet.
 */
function createDriveClient() {
  const clientId = getConfig("googleClientId");
  const clientSecret = getConfig("googleClientSecret");
  const refreshToken = getConfig("googleRefreshToken");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Drive is not connected. Please complete the Google setup in the Admin panel.",
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, "postmessage");
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: oauth2 });
}

/**
 * Exchange an authorization code for tokens.
 * Returns the access token (for the Picker) and stores the refresh token in the DB.
 */
export async function exchangeAuthCode(
  code: string,
): Promise<{ accessToken: string }> {
  const clientId = getConfig("googleClientId");
  const clientSecret = getConfig("googleClientSecret");

  if (!clientId || !clientSecret) {
    throw new Error("Google credentials are not configured.");
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, "postmessage");
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.access_token)
    throw new Error("No access token returned from Google.");
  if (tokens.refresh_token) {
    setConfig("googleRefreshToken", tokens.refresh_token);
  }

  return { accessToken: tokens.access_token };
}

/**
 * Create a sub-folder inside the parent Drive folder.
 * Returns the new folder's ID.
 */
export async function createDriveFolder(
  name: string,
  parentFolderId: string,
): Promise<string> {
  const drive = createDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
  });
  if (!res.data.id) throw new Error("Failed to create Drive folder");
  return res.data.id;
}

/**
 * Upload a file to a Drive folder.
 * Returns the uploaded file's Drive ID.
 */
export async function uploadFileToDrive(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  folderId: string,
): Promise<string> {
  const drive = createDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id",
  });
  if (!res.data.id) throw new Error("Failed to upload file to Drive");
  return res.data.id;
}

/**
 * Fetch the thumbnail URL for a Drive file.
 * Uses a two-level cache: in-memory (L1, process lifetime) and SQLite (L2,
 * survives restarts). TTL is 24 hours so restarts don't cold-hit the Drive API.
 * Returns null if the file has no thumbnail (e.g. a video still processing).
 */

const THUMBNAIL_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const thumbnailCache = new Map<string, { url: string; expiresAt: number }>();

export async function getThumbnailUrl(driveId: string): Promise<string | null> {
  // L1: in-memory cache
  const cached = thumbnailCache.get(driveId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  // L2: SQLite cache (survives server restarts)
  const dbCached = getCachedThumbnail(driveId);
  if (dbCached) {
    // Warm the in-memory cache too
    thumbnailCache.set(driveId, {
      url: dbCached,
      expiresAt: Date.now() + THUMBNAIL_TTL_MS,
    });
    return dbCached;
  }

  const drive = createDriveClient();
  const res = await drive.files.get({
    fileId: driveId,
    fields: "hasThumbnail,thumbnailLink",
  });
  if (!res.data.hasThumbnail || !res.data.thumbnailLink) return null;
  // Drive returns a small thumbnail by default; bump it to 400px wide
  const url = res.data.thumbnailLink.replace(/=s\d+$/, "=s400");
  const expiresAt = Date.now() + THUMBNAIL_TTL_MS;
  thumbnailCache.set(driveId, { url, expiresAt });
  setCachedThumbnail(driveId, url, expiresAt);
  return url;
}

/**
 * Move a file into a `_deleted` sub-folder inside the given parent folder.
 * The sub-folder is created on first use.
 */
export async function moveFileToBin(
  driveId: string,
  parentFolderId: string,
): Promise<void> {
  const drive = createDriveClient();

  // Find existing _deleted folder or create it
  const listRes = await drive.files.list({
    q: `name = '_deleted' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });

  const existingId = listRes.data.files?.[0]?.id;
  const binFolderId =
    existingId ?? (await createDriveFolder("_deleted", parentFolderId));

  // Move the file: add new parent, remove old parent atomically
  await drive.files.update({
    fileId: driveId,
    addParents: binFolderId,
    removeParents: parentFolderId,
    fields: "id",
  });
}
