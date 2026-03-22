# Memento

A self-hosted photo and video uploader for events. Guests scan a QR code and upload directly to your Google Drive — no accounts required.

## Features

- **Event management** — create named events with optional expiration dates, each backed by its own Drive subfolder
- **QR code generation** — each event gets a shareable QR code linking to a slug-based upload URL (e.g. `/upload/summer-wedding`)
- **Photo & video uploads** — guests select files from their device; a thumbnail grid previews selections before uploading
- **Upload history** — previously uploaded files are remembered per device and displayed as a lazy-loaded thumbnail grid (fetched from Drive)
- **Password-protected admin** — the admin portal requires a password stored as a bcrypt hash in the database; changeable from within the portal
- **Google Drive integration** — files are uploaded directly to Drive; folders are selected via the Google Picker API
- **No external services** — everything runs from a single Bun process with a local SQLite database

## Tech Stack

| Layer    | Technology                 |
| -------- | -------------------------- |
| Runtime  | [Bun](https://bun.sh)      |
| Frontend | React 19, TypeScript, Vite |
| UI       | Material UI (MUI) v7       |
| Backend  | Custom Bun HTTP server     |
| Database | SQLite via `bun:sqlite`    |
| Storage  | Google Drive API v3        |
| Linter   | Biome                      |

## Prerequisites

- [Bun](https://bun.sh) v1.x
- A Google Cloud project with the **Google Drive API** and **Google Picker API** enabled
- An **OAuth 2.0 Web Client ID** (for Picker and auth)
- A **Google API Key** (for the Picker)

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Configure Google Cloud

In the [Google Cloud Console](https://console.cloud.google.com):

1. Enable the **Google Drive API** and **Google Picker API**
2. Create an **OAuth 2.0 Web Client ID** — add your app's URL as an Authorised JavaScript Origin (e.g. `http://localhost:3000` for dev)
3. Create an **API Key** and restrict it to the Picker API

### 3. Run in development

```bash
bun dev
```

This starts the Vite dev server on port `3000` and the API server on port `3001` concurrently.

### 4. First-time admin setup

1. Open [http://localhost:3000/login](http://localhost:3000/login) and set your admin password
2. Enter your **Client ID**, **Client Secret**, and **API Key** in the Setup panel
3. Click **Sign in with Google & Choose Folder** to authorise Drive access and select a root folder
4. Create your first event

## Production

```bash
bun run build   # build the frontend
bun start       # serve everything from a single process on port 3000
```

The production server serves the built frontend as static files and handles all `/api` routes.

## Project Structure

```
server/
  index.ts          # HTTP router
  lib/
    db.ts           # SQLite access layer + migrations
    drive.ts        # Google Drive API client
    qr.ts           # QR code generation
  routes/
    auth.ts         # Login, change-password
    config.ts       # Google credentials + folder config
    events.ts       # Event CRUD + slug generation
    thumbnail.ts    # Drive thumbnail proxy (cached)
    upload.ts       # File upload handler
src/
  pages/
    LoginPage.tsx   # Password gate
    AdminPage.tsx   # Event management + setup
    UploadPage.tsx  # Guest upload interface
  lib/
    api.ts          # Typed fetch wrappers
    auth.ts         # Shared auth session key
  hooks/
    useGooglePicker.ts
```

## Scripts

| Command         | Description                   |
| --------------- | ----------------------------- |
| `bun dev`       | Start dev servers (UI + API)  |
| `bun run build` | Build frontend for production |
| `bun start`     | Run production server         |
| `bun run check` | Biome lint + format           |
