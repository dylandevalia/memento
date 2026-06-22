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

    disconnect: () => request<void>("/config/google", { method: "DELETE" }),
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
     * Upload a single file to the server's streaming proxy endpoint.
     * The server pipes the bytes straight through to Drive via a resumable
     * upload session, so the file is never fully buffered in server memory.
     *
     * XHR is used (instead of fetch) so upload progress events fire,
     * giving accurate per-file progress bars.
     */
    uploadFileWithProgress: (
      slug: string,
      file: File,
      onProgress: (loaded: number, total: number) => void,
    ): Promise<UploadResponse> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(e.loaded, e.total);
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText) as UploadResponse);
          } else {
            const err = JSON.parse(xhr.responseText) as {
              error?: string;
            };
            reject(new Error(err.error ?? xhr.statusText));
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("PUT", `/api/upload/${slug}/stream`);
        // Send file metadata as headers; body is raw bytes (no multipart).
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream",
        );
        xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
        xhr.send(file);
      }),
  },
};
