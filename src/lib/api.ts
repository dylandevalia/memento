import type {
  CreateEventPayload,
  CreateEventResponse,
  DriveConfig,
  Event,
  GoogleCredentials,
  UploadResponse,
  ValidateTokenResponse,
} from "../types";
import { STORAGE_KEYS } from "./constants";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionToken = sessionStorage.getItem(STORAGE_KEYS.ADMIN_AUTH);
  const authHeaders: Record<string, string> = sessionToken
    ? { Authorization: `Bearer ${sessionToken}` }
    : {};

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    status: () => request<{ hasPassword: boolean }>("/auth/status"),

    login: (password: string) =>
      request<{ ok: boolean; sessionToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      }),

    logout: () => request<void>("/auth/logout", { method: "POST" }),

    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: boolean }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),

    setInitialPassword: (newPassword: string) =>
      request<{ ok: boolean; sessionToken: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      }),
  },

  config: {
    get: () => request<DriveConfig>("/config"),

    getGoogle: () => request<GoogleCredentials>("/config/google"),

    saveGoogle: (clientId: string, clientSecret: string, apiKey: string) =>
      request<GoogleCredentials>("/config/google", {
        method: "POST",
        body: JSON.stringify({ clientId, clientSecret, apiKey }),
      }),

    exchangeAuthCode: (code: string) =>
      request<{ accessToken: string }>("/config/google-auth", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),

    setFolder: (folderId: string, folderName: string) =>
      request<DriveConfig>("/config/folder", {
        method: "POST",
        body: JSON.stringify({ folderId, folderName }),
      }),
  },

  events: {
    list: () => request<Event[]>("/events"),

    create: (payload: CreateEventPayload) =>
      request<CreateEventResponse>("/events", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    delete: (id: number) =>
      request<void>(`/events/${id}`, { method: "DELETE" }),

    validate: (slug: string) =>
      request<ValidateTokenResponse>(`/events/${slug}/validate`),

    qr: (slug: string) =>
      request<{ qrCodeDataUrl: string; uploadUrl: string }>(
        `/events/${slug}/qr`,
      ),
  },

  upload: {
    getThumbnailUrl: (driveId: string) => `/api/thumbnail/${driveId}`,

    deleteFile: (slug: string, driveId: string) =>
      request<void>(`/upload/${slug}/${driveId}`, { method: "DELETE" }),

    files: async (slug: string, files: File[]) => {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      const res = await fetch(`/api/upload/${slug}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? res.statusText);
      }
      return res.json() as Promise<UploadResponse>;
    },

    /**
     * Upload a single file directly to Google Drive, bypassing the server
     * as a data proxy. Three steps:
     *   1. POST /api/upload/:slug/session  — server creates a Drive resumable
     *      upload session and returns the pre-authenticated upload URI.
     *   2. PUT {uploadUri}               — browser sends bytes straight to
     *      Drive; XHR upload events give real progress on the actual transfer.
     *   3. POST /api/upload/:slug/confirm — server records the driveId in DB.
     */
    uploadFileWithProgress: async (
      slug: string,
      file: File,
      onProgress: (loaded: number, total: number) => void,
    ): Promise<UploadResponse> => {
      // Step 1: obtain a pre-authenticated Drive resumable upload URI
      const sessionRes = await fetch(`/api/upload/${slug}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });
      if (!sessionRes.ok) {
        const err = await sessionRes
          .json()
          .catch(() => ({ error: sessionRes.statusText }));
        throw new Error(
          (err as { error?: string }).error ?? sessionRes.statusText,
        );
      }
      const { uploadUri } = (await sessionRes.json()) as {
        uploadUri: string;
      };

      // Step 2: PUT the file directly to Drive (XHR so upload events fire)
      const driveId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded, e.total);
        };
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            const data = JSON.parse(xhr.responseText) as {
              id?: string;
            };
            if (data.id) {
              resolve(data.id);
            } else {
              reject(new Error("Drive did not return a file ID"));
            }
          } else {
            reject(new Error(`Drive upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () =>
          reject(new Error("Network error during Drive upload"));
        xhr.open("PUT", uploadUri);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream",
        );
        xhr.send(file);
      });

      // Step 3: confirm with server so the upload is recorded in the DB
      try {
        await fetch(`/api/upload/${slug}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driveId, fileName: file.name }),
        });
      } catch {
        // Non-fatal: the file is on Drive even if the DB write fails.
        // The admin can see it directly in Drive; it just won't appear
        // in the in-app history until the record is recovered.
        console.warn(
          "[upload] confirm call failed; file is on Drive but not recorded in DB",
        );
      }

      return { uploaded: 1, files: [{ name: file.name, driveId }] };
    },
  },
};
