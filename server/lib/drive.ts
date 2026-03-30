import { Readable } from "node:stream";
import { google } from "googleapis";
import { getConfig, setConfig } from "./db";

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

  // Add event listener to handle token refresh errors
  oauth2.on("tokens", (tokens) => {
    if (tokens.refresh_token) {
      setConfig("googleRefreshToken", tokens.refresh_token);
    }
  });

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
  try {
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
  } catch (err) {
    if (err instanceof Error && err.message?.includes("invalid_grant")) {
      throw new Error(
        "Google authentication expired. Please reconnect Google Drive in the Admin panel.",
      );
    }
    throw err;
  }
}

/**
 * Upload a file to a Drive folder.
 * Returns the uploaded file's Drive ID.
 * If uploaderName is provided, it will be stored in the file's metadata.
 */
export async function uploadFileToDrive(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  folderId: string,
  uploaderName?: string,
): Promise<string> {
  try {
    const drive = createDriveClient();

    // Prepare file metadata
    const fileMetadata: {
      name: string;
      parents: string[];
      properties?: { uploaderName: string };
    } = {
      name: fileName,
      parents: [folderId],
    };

    // Add uploader name to file properties if provided
    if (uploaderName) {
      fileMetadata.properties = { uploaderName };
    }

    const res = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id",
    });
    if (!res.data.id) throw new Error("Failed to upload file to Drive");
    return res.data.id;
  } catch (err) {
    // Handle invalid_grant error specifically
    if (err instanceof Error && err.message?.includes("invalid_grant")) {
      throw new Error(
        "Google authentication expired. Please reconnect Google Drive in the Admin panel.",
      );
    }
    throw err;
  }
}

/**
 * Fetch the thumbnail data for a Drive file.
 * Uses in-memory cache. TTL is 24 hours.
 * Returns null if the file has no thumbnail (e.g. a video still processing).
 */

const THUMBNAIL_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const thumbnailCache = new Map<
  string,
  { data: Buffer; contentType: string; expiresAt: number }
>();

export async function getThumbnailData(
  driveId: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  // L1: in-memory cache
  const cached = thumbnailCache.get(driveId);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data, contentType: cached.contentType };
  }

  try {
    const clientId = getConfig("googleClientId");
    const clientSecret = getConfig("googleClientSecret");
    const refreshToken = getConfig("googleRefreshToken");

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        "Google Drive is not connected. Please complete the Google setup in the Admin panel.",
      );
    }

    const oauth2 = new google.auth.OAuth2(
      clientId,
      clientSecret,
      "postmessage",
    );
    oauth2.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: "v3", auth: oauth2 });

    // First check if the file has a thumbnail and get the thumbnail URL
    const metaRes = await drive.files.get({
      fileId: driveId,
      fields: "hasThumbnail,thumbnailLink,mimeType",
    });

    if (!metaRes.data.hasThumbnail || !metaRes.data.thumbnailLink) {
      return null;
    }

    // Get access token from the OAuth2 client
    const accessToken = await oauth2.getAccessToken();

    // Fetch the thumbnail with authentication
    const thumbnailUrl = metaRes.data.thumbnailLink.replace(/=s\d+$/, "=s400");
    const thumbnailRes = await fetch(thumbnailUrl, {
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
      },
    });

    if (!thumbnailRes.ok) {
      throw new Error(`Failed to fetch thumbnail: ${thumbnailRes.status}`);
    }

    const data = Buffer.from(await thumbnailRes.arrayBuffer());
    const contentType =
      thumbnailRes.headers.get("content-type") || "image/jpeg";

    const expiresAt = Date.now() + THUMBNAIL_TTL_MS;
    thumbnailCache.set(driveId, { data, contentType, expiresAt });

    return { data, contentType };
  } catch (err) {
    if (err instanceof Error && err.message?.includes("invalid_grant")) {
      throw new Error(
        "Google authentication expired. Please reconnect Google Drive in the Admin panel.",
      );
    }
    throw err;
  }
}

/**
 * Move a file into a `_deleted` sub-folder inside the given parent folder.
 * The sub-folder is created on first use.
 */
export async function moveFileToBin(
  driveId: string,
  parentFolderId: string,
): Promise<void> {
  try {
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
  } catch (err) {
    if (err instanceof Error && err.message?.includes("invalid_grant")) {
      throw new Error(
        "Google authentication expired. Please reconnect Google Drive in the Admin panel.",
      );
    }
    throw err;
  }
}
