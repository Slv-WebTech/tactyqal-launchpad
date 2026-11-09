import express from "express";
import cors from "cors";
import { createHash, timingSafeEqual } from "node:crypto";
import { tx } from "./db.js";
import { loadConfig } from "./config.js";

const slugify = (s) => {
  const slug = s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "post";
  // Purely numeric slugs would be ambiguous with numeric ids in /posts/:idOrSlug.
  return /^\d+$/.test(slug) ? `post-${slug}` : slug;
};
const readMinutes = (text) => Math.max(1, Math.round(text.trim().split(/\s+/).filter(Boolean).length / 200));
const nowIso = () => new Date().toISOString();
const digest = (s) => createHash("sha256").update(String(s ?? "")).digest();

// Tags come back in the same query (no N+1); list queries never read the (large) content column.
const TAGS_SQL = `COALESCE((SELECT json_group_array(name) FROM
  (SELECT t.name FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id ORDER BY t.name)), '[]') AS tags`;
const LIST_COLS = `p.id, p.slug, p.title, p.excerpt, p.author, p.cover_image, p.status, p.read_minutes,
  p.published_at, p.created_at, p.updated_at, p.sort_at, ${TAGS_SQL}`;
const withTags = (row) => (row ? { ...row, tags: JSON.parse(row.tags) } : row);
const publicShape = ({ sort_at, ...rest }) => rest; // sort_at is an internal ordering column

export function createApp(db, config = loadConfig()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // ---- auth: constant-time key comparison; open only when no key is configured (non-production) ----
  const keyDigest = config.adminKey ? digest(config.adminKey) : null;
  const isAdmin = (req) => keyDigest === null || timingSafeEqual(digest(req.get("x-admin-key")), keyDigest);
  const requireKey = (req, res, next) =>
    isAdmin(req) ? next() : res.status(401).json({ error: "Invalid or missing admin key" });

  // ---- prepared once, reused for every request ----
  const q = {
    byId: db.prepare(`SELECT ${LIST_COLS}, p.content FROM posts p WHERE p.id = ?`),
    bySlug: db.prepare(`SELECT ${LIST_COLS}, p.content FROM posts p WHERE p.slug = ?`),
    slugTaken: db.prepare("SELECT 1 FROM posts WHERE slug = ? AND id != ?"),
    insertPost: db.prepare(
      `INSERT INTO posts (slug, title, excerpt, content, author, cover_image, status, read_minutes, published_at, sort_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    updatePost: db.prepare(
      `UPDATE posts SET slug=?, title=?, excerpt=?, content=?, author=?, cover_image=?, status=?, read_minutes=?,
       published_at=?, sort_at=?, updated_at=? WHERE id=?`
    ),
    deletePost: db.prepare("DELETE FROM posts WHERE id = ?"),
    clearTags: db.prepare("DELETE FROM post_tags WHERE post_id = ?"),
    insertTag: db.prepare("INSERT OR IGNORE INTO tags(name) VALUES (?)"),
    tagId: db.prepare("SELECT id FROM tags WHERE name = ?"),
    linkTag: db.prepare("INSERT INTO post_tags(post_id, tag_id) VALUES (?, ?)"),
    tagCounts: db.prepare(
      `SELECT t.name, COUNT(*) AS count FROM tags t JOIN post_tags pt ON pt.tag_id = t.id
       JOIN posts p ON p.id = pt.post_id AND p.status = 'published' GROUP BY t.id ORDER BY count DESC, t.name`
    ),
  };
  const findOne = (idOrSlug) => withTags(/^\d+$/.test(idOrSlug) ? q.byId.get(Number(idOrSlug)) : q.bySlug.get(idOrSlug));

  function setTags(postId, tags) {
    q.clearTags.run(postId);
    for (const name of [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))]) {
      q.insertTag.run(name);
      q.linkTag.run(postId, q.tagId.get(name).id);
    }
  }

  function validate(body, partial) {
    const errors = [];
    const str = (k, max) => {
      if (body[k] === undefined) return;
      if (typeof body[k] !== "string") errors.push(`${k} must be a string`);
      else if (body[k].length > max) errors.push(`${k} must be at most ${max} characters`);
    };
    if (!partial && (typeof body.title !== "string" || !body.title.trim())) errors.push("title is required");
    if (partial && body.title !== undefined && !String(body.title).trim()) errors.push("title cannot be empty");
    str("title", 200); str("excerpt", 500); str("content", 200000); str("author", 100); str("cover_image", 500);
    if (body.status !== undefined && !["draft", "published"].includes(body.status)) errors.push("status must be 'draft' or 'published'");
    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags) || body.tags.length > 20 || body.tags.some((t) => typeof t !== "string" || t.length > 50))
        errors.push("tags must be an array of at most 20 strings of up to 50 characters");
    }
    return errors;
  }

  const uniqueSlug = (base, ignoreId = -1) => {
    let slug = base, n = 2;
    while (q.slugTaken.get(slug, ignoreId)) slug = `${base}-${n++}`;
    return slug;
  };

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  // readiness: proves the DB answers (use this for load-balancer checks)
  app.get("/api/ready", (_req, res) => {
    try { db.prepare("SELECT 1").get(); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
  });

  // LIST: ?q= &tag= &status=published|draft|all &page= &limit=
  app.get("/api/posts", (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    let status = ["draft", "published", "all"].includes(req.query.status) ? req.query.status : "published";
    if (!isAdmin(req)) status = "published"; // drafts are only visible to admins
    const where = [], params = [];
    if (status !== "all") { where.push("p.status = ?"); params.push(status); }
    if (req.query.q) {
      where.push("(p.title LIKE ? ESCAPE '\\' OR p.excerpt LIKE ? ESCAPE '\\' OR p.content LIKE ? ESCAPE '\\')");
      const like = `%${String(req.query.q).replace(/[\\%_]/g, "\\$&")}%`;
      params.push(like, like, like);
    }
    if (req.query.tag) {
      where.push("EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.name = ?)");
      params.push(String(req.query.tag).toLowerCase());
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = db.prepare(`SELECT COUNT(*) c FROM posts p ${clause}`).get(...params).c;
    const rows = db
      .prepare(`SELECT ${LIST_COLS} FROM posts p ${clause} ORDER BY p.sort_at DESC, p.id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, (page - 1) * limit);
    res.json({ data: rows.map((r) => publicShape(withTags(r))), meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  });

  app.get("/api/tags", (_req, res) => res.json({ data: q.tagCounts.all() }));

  // READ by numeric id or slug
  app.get("/api/posts/:idOrSlug", (req, res) => {
    const row = findOne(req.params.idOrSlug);
    if (!row || (row.status !== "published" && !isAdmin(req))) return res.status(404).json({ error: "Post not found" });
    res.json({ data: publicShape(row) });
  });

  // CREATE (atomic: post + tags commit together or not at all)
  app.post("/api/posts", requireKey, (req, res) => {
    const body = req.body || {};
    const errors = validate(body, false);
    if (errors.length) return res.status(400).json({ error: "Validation failed", details: errors });
    const status = body.status || "draft";
    const content = body.content || "";
    const now = nowIso();
    const post = tx(db, () => {
      const info = q.insertPost.run(
        uniqueSlug(slugify(body.title)), body.title.trim(), body.excerpt || "", content, body.author || "Tactyqal",
        body.cover_image || null, status, readMinutes(content), status === "published" ? now : null, now, now, now
      );
      const id = Number(info.lastInsertRowid);
      setTags(id, body.tags || []);
      return findOne(String(id));
    });
    res.status(201).json({ data: publicShape(post) });
  });

  // UPDATE (partial; PUT and PATCH behave the same)
  const update = (req, res) => {
    const body = req.body || {};
    const errors = validate(body, true);
    const row = findOne(req.params.idOrSlug);
    if (!row) return res.status(404).json({ error: "Post not found" });
    if (errors.length) return res.status(400).json({ error: "Validation failed", details: errors });
    const next = { ...row, ...Object.fromEntries(Object.entries(body).filter(([k]) => ["title", "excerpt", "content", "author", "cover_image", "status"].includes(k))) };
    const now = nowIso();
    if (body.title !== undefined) next.title = body.title.trim();
    const post = tx(db, () => {
      if (body.title !== undefined && next.title !== row.title) next.slug = uniqueSlug(slugify(next.title), row.id);
      if (next.status === "published" && !row.published_at) { next.published_at = now; next.sort_at = now; }
      q.updatePost.run(next.slug, next.title, next.excerpt, next.content, next.author, next.cover_image, next.status,
        readMinutes(next.content), next.published_at, next.sort_at, now, row.id);
      if (body.tags !== undefined) setTags(row.id, body.tags);
      return findOne(String(row.id));
    });
    res.json({ data: publicShape(post) });
  };
  app.put("/api/posts/:idOrSlug", requireKey, update);
  app.patch("/api/posts/:idOrSlug", requireKey, update);

  // DELETE
  app.delete("/api/posts/:idOrSlug", requireKey, (req, res) => {
    const row = findOne(req.params.idOrSlug);
    if (!row) return res.status(404).json({ error: "Post not found" });
    q.deletePost.run(row.id);
    res.status(204).end();
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
    if (/UNIQUE constraint failed: posts\.slug/.test(err.message || "")) return res.status(409).json({ error: "A post with this slug already exists" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}
