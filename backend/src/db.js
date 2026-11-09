import { DatabaseSync } from "node:sqlite";

const ISO_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

// Schema: posts <-> tags (many-to-many). SQLite keeps setup zero-config;
// the SQL is standard enough to port to PostgreSQL (see README).
// All timestamps are ISO-8601 so they sort correctly as strings.
export function openDb(file = process.env.DB_FILE || "blog.db") {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS posts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      slug         TEXT NOT NULL UNIQUE,
      title        TEXT NOT NULL,
      excerpt      TEXT NOT NULL DEFAULT '',
      content      TEXT NOT NULL DEFAULT '',
      author       TEXT NOT NULL DEFAULT 'Tactyqal',
      cover_image  TEXT,
      status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
      read_minutes INTEGER NOT NULL DEFAULT 1,
      published_at TEXT,
      created_at   TEXT NOT NULL DEFAULT (${ISO_NOW}),
      updated_at   TEXT NOT NULL DEFAULT (${ISO_NOW}),
      sort_at      TEXT NOT NULL DEFAULT (${ISO_NOW})
    );
    CREATE TABLE IF NOT EXISTS tags (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS post_tags (
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    );
  `);
  migrate(db);
  return db;
}

// Idempotent migration for databases created before `sort_at` existed.
function migrate(db) {
  const cols = db.prepare("PRAGMA table_info(posts)").all().map((c) => c.name);
  if (!cols.includes("sort_at")) {
    db.exec(`ALTER TABLE posts ADD COLUMN sort_at TEXT NOT NULL DEFAULT '';
      UPDATE posts SET sort_at = COALESCE(published_at, strftime('%Y-%m-%dT%H:%M:%fZ', created_at));`);
  }
  db.exec(`
    DROP INDEX IF EXISTS idx_posts_status_pub;
    -- list ordering is fully covered by this index: no temp B-tree sort, cheap deep pages
    CREATE INDEX IF NOT EXISTS idx_posts_list ON posts(status, sort_at DESC, id DESC);
    -- tag counts / tag filter
    CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id, post_id);
  `);
}

// Run fn inside a write transaction; roll back on any error so a request never half-applies.
export function tx(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
