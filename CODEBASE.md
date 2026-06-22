# Memento — Codebase Reference

## Project overview

Self-hosted photo/video uploader for events. Guests scan a QR code, land on `/event/:slug`, upload directly to the host's Google Drive — no account required. Password-protected admin portal at `/admin` manages events and Google credentials.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun v1.x (HTTP server + build toolchain) |
| Frontend | React 19, TypeScript, Vite 8 |
| Routing (client) | React Router v7 (`BrowserRouter`) |
| UI | MUI v7 + Emotion; custom purple theme in `src/App.tsx` |
| Backend | Custom `Bun.serve()` — no framework |
| Database | SQLite via `bun:sqlite`, single file `data.db` |
| Storage | Google Drive API v3 (`googleapis` npm package) |
| Linter/formatter | Biome v2 |
| Containerisation | Docker; image `dylandevalia/memento:latest` |

---

## Repository layout

```
memento/
├── server/
│   ├── index.ts              # Manual pattern-matching router, CORS, static serving
│   ├── lib/
│   │   ├── db.ts             # SQLite access layer, inline migrations
│   │   ├── drive.ts          # Google Drive OAuth2 client + Drive v3 operations
│   │   ├── qr.ts             # QR code data-URL generation (qrcode package)
│   │   └── rateLimit.ts      # Fixed-window in-memory rate limiter
│   └── routes/
│       ├── auth.ts           # /api/auth/*
│       ├── config.ts         # /api/config/*
│       ├── events.ts         # /api/events/*
│       ├── thumbnail.ts      # /api/thumbnail/:driveId
│       └── upload.ts         # /api/upload/:token  (POST) + /api/upload/:slug/:driveId (DELETE)
├── src/
│   ├── main.tsx              # createRoot, BrowserRouter, global CSS imports
│   ├── App.tsx               # MUI ThemeProvider, route table, RequireAuth guard
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── AdminPage.tsx
│   │   └── EventPage.tsx
│   ├── components/
│   │   ├── ErrorBoundary.tsx
│   │   ├── contributions/    # Lazy thumbnail grid of uploaded files
│   │   ├── file-upload/      # File selection, progress bars, confetti on success
│   │   ├── gallery-viewer/   # Full-screen image/video viewer
│   │   ├── page-background/  # Decorative animated background
│   │   ├── page-header/      # Top bar with QR button
│   │   └── qr-modal/         # QR code dialog
│   ├── hooks/
│   │   ├── useGooglePicker.ts
│   │   ├── useLazyImage.ts
│   │   ├── useLocalStorage.ts
│   │   └── useUploadHistory.ts
│   ├── lib/
│   │   ├── api.ts            # Typed fetch/XHR wrappers
│   │   ├── auth.ts           # Re-exports ADMIN_AUTH_KEY constant
│   │   ├── constants.ts      # STORAGE_KEYS, LIMITS, CUSTOM_EVENTS, TIMEOUTS, IMAGE_LOADING
│   │   └── errorHandler.ts   # Normalised error logger
│   ├── types/
│   │   └── index.ts          # All shared TypeScript interfaces
│   └── utils/
│       ├── material3.ts
│       └── random.ts
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── biome.json
├── package.json
├── Dockerfile
├── docker-compose.yml
└── docker-compose.override.yml
```

---

## Database schema (`server/lib/db.ts`)

Single file `data.db`. Path is `"data.db"` (relative to process CWD). Docker Compose sets `working_dir: /data` so the file lands at `/data/data.db` on the persistent volume.

```sql
events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  slug            TEXT    NOT NULL UNIQUE,   -- URL-safe, e.g. "summer-wedding"
  token           TEXT    NOT NULL UNIQUE,   -- UUID via crypto.randomUUID()
  drive_folder_id TEXT    NOT NULL,
  expires_at      TEXT,                      -- ISO 8601, nullable
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
)

config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
)
-- Keys: admin_password_hash, googleClientId, googleClientSecret,
--       googleApiKey, googleRefreshToken, rootFolderId, rootFolderName

thumbnail_cache (
  drive_id   TEXT PRIMARY KEY,
  url        TEXT NOT NULL,
  expires_at INTEGER NOT NULL   -- Unix ms
)
-- NOTE: getCachedThumbnail/setCachedThumbnail are defined but NEVER CALLED.
--       Thumbnail caching is in-memory only (see drive.ts).

uploads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  drive_id      TEXT    NOT NULL,
  file_name     TEXT    NOT NULL,
  uploader_name TEXT,
  uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now'))
)

CREATE INDEX idx_uploads_event_id ON uploads(event_id);
CREATE INDEX idx_uploads_drive_id ON uploads(drive_id);
```

### Inline migration

At startup, `db.ts` checks `PRAGMA table_info(events)`. If `expires_at` has `notnull = 1` or the `slug` column is absent, it recreates `events` inside a `BEGIN TRANSACTION`, backfilling `slug = token` for existing rows.

### DB helper functions

| Function | Description |
|----------|-------------|
| `getConfig(key)` | Returns `string \| null` |
| `setConfig(key, value)` | Upsert into `config` |
| `createEvent(name, slug, token, driveFolderId, expiresAt)` | `INSERT ... RETURNING *` → `Event` |
| `getEventBySlug(slug)` | Lookup by `slug` column |
| `getEventByToken(token)` | **Dead code** — never called from any route |
| `slugExists(slug)` | Boolean check |
| `listEvents()` | `ORDER BY created_at DESC` |
| `deleteEvent(id)` | Cascades to `uploads` |
| `recordUpload(eventId, driveId, fileName, uploaderName)` | Insert into `uploads` |
| `getPasswordHash()` | `getConfig("admin_password_hash")` |
| `setPasswordHash(hash)` | `setConfig("admin_password_hash", hash)` |
| `getCachedThumbnail(driveId)` | **Dead code** — never called |
| `setCachedThumbnail(driveId, url, expiresAt)` | **Dead code** — never called |

---

## Server router (`server/index.ts`)

`Bun.serve()` with a single `fetch` handler. Route dispatch is manual `pathname.match()` — no framework. Each route module exports a plain object keyed by path string with `GET`/`POST`/`DELETE` methods.

Parameters are injected by `Object.assign(req, { params })` before passing to the handler.

**CORS**: dev → `Access-Control-Allow-Origin: http://localhost:3000`; production → `*`. Preflight OPTIONS returns 204. `withCors()` wraps every response.

**Static files**: production only. Unmatched paths try `Bun.file(distDir + pathname)`; falls back to `dist/index.html`. Dev returns 404 for unmatched paths.

**`maxRequestBodySize`**: 2 GB.

**Port**: dev = 3001, production = 3000.

---

## API routes

All under `/api`. **No auth middleware — admin routes are not server-verified.** Auth is client-only (`sessionStorage`).

### Auth (`server/routes/auth.ts`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/auth/status` | `{ hasPassword: boolean }` |
| POST | `/api/auth/login` | Body: `{ password }`. `Bun.password.verify()` (bcrypt). Returns `{ ok: true }` or 401. |
| POST | `/api/auth/change-password` | Body: `{ currentPassword?, newPassword }`. Skips current-password check if no hash exists (first-time setup). |

### Config (`server/routes/config.ts`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/config` | Returns `DriveConfig` |
| GET | `/api/config/google` | Returns `GoogleCredentials` — secret never exposed |
| POST | `/api/config/google` | Saves `clientId`, `clientSecret`, `apiKey`; clears refresh token |
| POST | `/api/config/google-auth` | Body: `{ code }`. Exchanges OAuth code; stores refresh token; returns `{ accessToken }` |
| POST | `/api/config/folder` | Body: `{ folderId, folderName }` |

### Events (`server/routes/events.ts`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/events` | List all events |
| POST | `/api/events` | Slugify name → create Drive folder → insert row → generate QR → return `CreateEventResponse` |
| DELETE | `/api/events/:id` | Cascades to `uploads`. Does NOT delete the Drive folder. |
| GET | `/api/events/:token/validate` | `:token` is the **slug**. Checks expiry. |
| GET | `/api/events/:token/qr` | `:token` is the **slug**. Regenerates QR data URL. |

**Naming inconsistency**: URL parameter is `:token` but all lookups use `getEventBySlug()`. The UUID `token` field is stored but `getEventByToken()` is dead code.

**Slug generation**: `slugify()` lowercases, strips diacritics, replaces non-`[a-z0-9]` with `-`. `uniqueSlug()` appends `-2`, `-3`, … on collision.

### Upload (`server/routes/upload.ts`)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/upload/:token` | `:token` = slug. Rate-limited 50 req/min/IP. Multipart `files[]` + optional `uploaderName`. `image/*` and `video/*` only. Serial Drive upload. |
| DELETE | `/api/upload/:slug/:driveId` | Soft-delete: moves to `_deleted/` subfolder. |

### Thumbnail (`server/routes/thumbnail.ts`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/thumbnail/:driveId` | Proxied binary. `Cache-Control: public, max-age=86400, immutable`. 404 if no thumbnail. |

---

## Google Drive integration (`server/lib/drive.ts`)

- **`createDriveClient()`** — reads credentials from DB, builds OAuth2 client with `redirect_uri: "postmessage"`, returns Drive v3 client.
- **`exchangeAuthCode(code)`** — `oauth2.getToken(code)` → stores refresh token → returns `{ accessToken }`.
- **`createDriveFolder(name, parentFolderId)`** — creates subfolder, returns ID.
- **`uploadFileToDrive(fileName, mimeType, buffer, folderId, uploaderName?)`** — `Readable.from(buffer)`, stores `uploaderName` in Drive file properties if provided.
- **`getThumbnailData(driveId)`** — in-memory `Map` cache (24h TTL). Fetches `hasThumbnail` + `thumbnailLink`, resizes to `=s400`, fetches binary with bearer token. Returns `null` if no thumbnail.
- **`moveFileToBin(driveId, parentFolderId)`** — finds/creates `_deleted/` subfolder, atomically moves file via `addParents` + `removeParents`.

All functions catch `invalid_grant` and throw a user-friendly reconnect message.

**OAuth scopes**: `drive.file` + `drive.metadata.readonly`

---

## Rate limiting (`server/lib/rateLimit.ts`)

Fixed-window counter. Module-level `Map<string, { count, resetTime }>`. GC every 5 min. Upload limit: 50 req / 60 s / IP. Returns 429 + `Retry-After` + `X-RateLimit-Reset`.

---

## Frontend routes (`src/App.tsx`)

| Path | Component | Guard |
|------|-----------|-------|
| `/login` | `LoginPage` | Public |
| `/admin` | `AdminPage` | `RequireAuth` (sessionStorage check) |
| `/event/:slug` | `EventPage` | Public |
| `/` | → `/admin` | — |
| `*` | → `/login` | — |

In production, pages are `lazy()`-loaded. In dev, eagerly imported for HMR. `App.tsx` uses top-level `await`.

---

## Frontend key patterns

**`src/lib/api.ts`**: `request<T>()` throws on non-2xx. `uploadFileWithProgress` uses XHR for progress events. Base path `/api` is relative (works dev + prod).

**Auth**: `sessionStorage["memento:admin:auth"] = "1"` set on login. Never sent to server.

**Upload history** (`useUploadHistory`): `localStorage["memento:uploads:{slug}"]` stores `UploadRecord[]`. Cross-component sync via `CustomEvent("memento-upload-complete")`.

**Google Picker** (`useGooglePicker`): dynamically loads gapi + GIS scripts → OAuth code flow (popup) → POST code to server → open Drive Picker with returned access token.

**Lazy images** (`useLazyImage`): `IntersectionObserver`, `rootMargin: "50px"`, `threshold: 0.1`.

---

## TypeScript interfaces (`src/types/index.ts`)

```typescript
Event          { id, name, slug, token, driveFolderId, expiresAt, createdAt }
Upload         { id, eventId, driveId, fileName, uploaderName, uploadedAt }
GoogleCredentials { clientId, apiKey, connected }
DriveConfig    { rootFolderId, rootFolderName }
CreateEventPayload  { name, expiresAt? }
CreateEventResponse { event, qrCodeDataUrl, uploadUrl }
ValidateTokenResponse { valid, event?: Pick<Event, "id"|"name"|"expiresAt">, error? }
UploadResponse { uploaded: number, files: { name, driveId }[] }
UploadFile     { name, rawFile: File, progress: number | null }
UploadRecord   { name, driveId, uploadedAt }
GalleryFile    = UploadFile | (UploadRecord & { progress? })
AsyncData<T>   = idle | loading | { status:"success"; data:T } | { status:"error"; error:string }
ApiSuccess<T>  { success: true; data: T }
ApiError       { success: false; error: string; code? }
ApiResponse<T> = ApiSuccess<T> | ApiError  // defined but api.ts uses throwing wrapper, not this union
```

---

## Constants (`src/lib/constants.ts`)

```
STORAGE_KEYS.ADMIN_AUTH         "memento:admin:auth"           sessionStorage
STORAGE_KEYS.UPLOADS(slug)      "memento:uploads:{slug}"       localStorage
LIMITS.MAX_UPLOAD_SIZE          2 GB  (client-side guard)
LIMITS.CONCURRENT_UPLOADS       5     (frontend only, not server-enforced)
LIMITS.PROGRESS_THROTTLE_MS     100
CUSTOM_EVENTS.UPLOAD_COMPLETE   "memento-upload-complete"
TIMEOUTS.DELETE_ANIMATION_MS    500
TIMEOUTS.VALIDATION_DELAY_MS    500   (artificial UX delay)
TIMEOUTS.REQUEST_CACHE_TTL_MS   5000
IMAGE_LOADING.INTERSECTION_ROOT_MARGIN  "50px"
IMAGE_LOADING.LAZY_LOAD_THRESHOLD       0.1
```

---

## Build and deployment

### Scripts
```
bun dev        # vite (3000) + bun --hot server/index.ts (3001)
bun run build  # vite build → dist/
bun start      # NODE_ENV=production bun server/index.ts (3000)
bun run check  # biome check --write .
```

### Docker
Two-stage build (`oven/bun:1` → `oven/bun:1-slim`). `docker-compose.yml`: ports `8888:3000`, `working_dir: /data`, volume `memento-data:/data`. Image auto-published on push to `main` via GitHub Actions.

---

## Security notes

- **Admin routes have no server-side auth.** Any HTTP client can call admin endpoints without credentials.
- Rate limiting is guest-upload-only (`POST /api/upload/:token`).
- `googleClientSecret` and `googleRefreshToken` are DB-only, never returned to clients.
- File deletion is soft (moved to `_deleted/` in Drive), not trashed.
`
