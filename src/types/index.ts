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

export interface Upload {
  id: number;
  eventId: number;
  driveId: string;
  fileName: string;
  uploaderName: string | null;
  uploadedAt: string; // ISO 8601
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

export interface UploadFile {
  name: string;
  rawFile: File;
  progress: number | null;
}

export interface UploadRecord {
  name: string;
  driveId: string;
  uploadedAt: string; // ISO 8601
}

export type GalleryFile = UploadFile | (UploadRecord & { progress?: number });

// ── Async Data Loading States ────────────────────────────────────────────
export type LoadingState = "idle" | "loading" | "success" | "error";

export type AsyncData<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

// ── API Response Types ────────────────────────────────────────────────────
export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: string;
  code?: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
