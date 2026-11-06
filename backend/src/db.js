import { DatabaseSync } from "node:sqlite";

// Schema: posts <-> tags (many-to-many). SQLite keeps setup zero-config;
// the SQL is standard enough to port to PostgreSQL (see README).
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
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
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
    CREATE INDEX IF NOT EXISTS idx_posts_status_pub ON posts(status, published_at DESC);
  `);
  return db;
}
