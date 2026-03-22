import { Database } from "bun:sqlite";
import type { Event } from "../../src/types";

const db = new Database("data.db", { create: true });

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    slug          TEXT    NOT NULL UNIQUE,
    token         TEXT    NOT NULL UNIQUE,
    drive_folder_id TEXT  NOT NULL,
    expires_at    TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS thumbnail_cache (
    drive_id   TEXT PRIMARY KEY,
    url        TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

// Migration: make expires_at nullable if the column was created with NOT NULL
// and add slug column if missing (backfill with token value for existing rows)
{
  const cols = db.prepare("PRAGMA table_info(events)").all() as {
    name: string;
    notnull: number;
  }[];
  const expiresAtCol = cols.find((c) => c.name === "expires_at");
  const hasSlug = cols.some((c) => c.name === "slug");

  if (expiresAtCol?.notnull === 1 || !hasSlug) {
    db.exec(`
      BEGIN TRANSACTION;
      CREATE TABLE events_new (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT    NOT NULL,
        slug            TEXT    NOT NULL UNIQUE DEFAULT '',
        token           TEXT    NOT NULL UNIQUE,
        drive_folder_id TEXT    NOT NULL,
        expires_at      TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO events_new (id, name, slug, token, drive_folder_id, expires_at, created_at)
        SELECT id, name, token, token, drive_folder_id, expires_at, created_at FROM events;
      DROP TABLE events;
      ALTER TABLE events_new RENAME TO events;
      -- Remove the DEFAULT so future inserts must supply slug explicitly
      COMMIT;
    `);
  }
}

export function getConfig(key: string): string | null {
  const row = db
    .prepare("SELECT value FROM config WHERE key = $key")
    .get({ $key: key }) as { value: string } | null;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string): void {
  db.prepare(
    "INSERT INTO config (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run({ $key: key, $value: value });
}

function rowToEvent(row: Record<string, unknown>): Event {
  return {
    id: row.id as number,
    name: row.name as string,
    slug: row.slug as string,
    token: row.token as string,
    driveFolderId: row.drive_folder_id as string,
    expiresAt: (row.expires_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createEvent(
  name: string,
  slug: string,
  token: string,
  driveFolderId: string,
  expiresAt: string | null,
): Event {
  const stmt = db.prepare(`
    INSERT INTO events (name, slug, token, drive_folder_id, expires_at)
    VALUES ($name, $slug, $token, $driveFolderId, $expiresAt)
    RETURNING *
  `);
  const row = stmt.get({
    $name: name,
    $slug: slug,
    $token: token,
    $driveFolderId: driveFolderId,
    $expiresAt: expiresAt,
  }) as Record<string, unknown>;
  return rowToEvent(row);
}

export function getEventByToken(token: string): Event | null {
  const stmt = db.prepare("SELECT * FROM events WHERE token = $token");
  const row = stmt.get({ $token: token }) as Record<string, unknown> | null;
  return row ? rowToEvent(row) : null;
}

export function getEventBySlug(slug: string): Event | null {
  const stmt = db.prepare("SELECT * FROM events WHERE slug = $slug");
  const row = stmt.get({ $slug: slug }) as Record<string, unknown> | null;
  return row ? rowToEvent(row) : null;
}

export function slugExists(slug: string): boolean {
  return Boolean(
    db.prepare("SELECT 1 FROM events WHERE slug = $slug").get({ $slug: slug }),
  );
}

export function listEvents(): Event[] {
  const stmt = db.prepare("SELECT * FROM events ORDER BY created_at DESC");
  const rows = stmt.all() as Record<string, unknown>[];
  return rows.map(rowToEvent);
}

export function deleteEvent(id: number): void {
  db.prepare("DELETE FROM events WHERE id = $id").run({ $id: id });
}

export function getPasswordHash(): string | null {
  return getConfig("admin_password_hash");
}

export function setPasswordHash(hash: string): void {
  setConfig("admin_password_hash", hash);
}

export function getCachedThumbnail(driveId: string): string | null {
  const row = db
    .prepare(
      "SELECT url, expires_at FROM thumbnail_cache WHERE drive_id = $driveId",
    )
    .get({ $driveId: driveId }) as { url: string; expires_at: number } | null;
  if (!row || row.expires_at < Date.now()) return null;
  return row.url;
}

export function setCachedThumbnail(
  driveId: string,
  url: string,
  expiresAt: number,
): void {
  db.prepare(
    `INSERT INTO thumbnail_cache (drive_id, url, expires_at)
     VALUES ($driveId, $url, $expiresAt)
     ON CONFLICT(drive_id) DO UPDATE SET url = excluded.url, expires_at = excluded.expires_at`,
  ).run({ $driveId: driveId, $url: url, $expiresAt: expiresAt });
}
