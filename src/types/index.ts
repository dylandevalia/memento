export interface GoogleCredentials {
  /** OAuth 2.0 Web Client ID — safe to expose to the browser */
  clientId: string | null;
  /** Google Picker API key — safe to expose to the browser */
  apiKey: string | null;
  /** Whether a refresh token has been stored (i.e. the admin has authenticated) */
  connected: boolean;
}

export interface DriveConfig {
  rootFolderId: string | null;
  rootFolderName: string | null;
}

export interface Event {
  id: number;
  name: string;
  slug: string;
  token: string;
  driveFolderId: string;
  expiresAt: string | null; // ISO 8601, null = no expiration
  createdAt: string; // ISO 8601
}

export interface CreateEventPayload {
  name: string;
  expiresAt?: string | null; // ISO 8601, omit or null = no expiration
}

export interface CreateEventResponse {
  event: Event;
  qrCodeDataUrl: string;
  uploadUrl: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  event?: Pick<Event, "id" | "name" | "expiresAt">;
  error?: string;
}

export interface UploadResponse {
  uploaded: number;
  files: { name: string; driveId: string }[];
}
