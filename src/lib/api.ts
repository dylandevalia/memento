import type {
  CreateEventPayload,
  CreateEventResponse,
  DriveConfig,
  Event,
  GoogleCredentials,
  UploadResponse,
  ValidateTokenResponse,
} from "../types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
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
      request<{ ok: boolean }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      }),

    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: boolean }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      }),

    setInitialPassword: (newPassword: string) =>
      request<{ ok: boolean }>("/auth/change-password", {
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

    validate: (token: string) =>
      request<ValidateTokenResponse>(`/events/${token}/validate`),

    qr: (slug: string) =>
      request<{ qrCodeDataUrl: string; uploadUrl: string }>(
        `/events/${slug}/qr`,
      ),
  },

  upload: {
    deleteFile: (slug: string, driveId: string) =>
      request<void>(`/upload/${slug}/${driveId}`, { method: "DELETE" }),

    files: (token: string, files: File[]) => {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      return fetch(`/api/upload/${token}`, { method: "POST", body: form }).then(
        async (res) => {
          if (!res.ok) {
            const err = await res
              .json()
              .catch(() => ({ error: res.statusText }));
            throw new Error(
              (err as { error?: string }).error ?? res.statusText,
            );
          }
          return res.json() as Promise<UploadResponse>;
        },
      );
    },
  },
};
