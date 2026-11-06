import express from "express";
import cors from "cors";

const slugify = (s) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "post";
const readMinutes = (text) => Math.max(1, Math.round(text.trim().split(/\s+/).filter(Boolean).length / 200));

export function createApp(db) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  // Writes are open unless ADMIN_KEY is set; then they need `x-admin-key`.
  const requireKey = (req, res, next) => {
    const key = process.env.ADMIN_KEY;
    if (key && req.get("x-admin-key") !== key) return res.status(401).json({ error: "Invalid or missing admin key" });
    next();
  };

  const tagsOf = db.prepare(
    "SELECT t.name FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ? ORDER BY t.name"
  );
  const hydrate = (row, withContent) => {
    if (!row) return row;
    const { content, ...rest } = row;
    return { ...rest, tags: tagsOf.all(row.id).map((t) => t.name), ...(withContent ? { content } : {}) };
  };
  const findOne = (idOrSlug) =>
    /^\d+$/.test(idOrSlug)
      ? db.prepare("SELECT * FROM posts WHERE id = ?").get(Number(idOrSlug))
      : db.prepare("SELECT * FROM posts WHERE slug = ?").get(idOrSlug);

  function setTags(postId, tags) {
    db.prepare("DELETE FROM post_tags WHERE post_id = ?").run(postId);
    for (const name of [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))]) {
      db.prepare("INSERT OR IGNORE INTO tags(name) VALUES (?)").run(name);
      const { id } = db.prepare("SELECT id FROM tags WHERE name = ?").get(name);
      db.prepare("INSERT INTO post_tags(post_id, tag_id) VALUES (?, ?)").run(postId, id);
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
    if (body.tags !== undefined && !Array.isArray(body.tags)) errors.push("tags must be an array of strings");
    return errors;
  }

  const uniqueSlug = (base, ignoreId = -1) => {
    let slug = base, n = 2;
    while (db.prepare("SELECT 1 FROM posts WHERE slug = ? AND id != ?").get(slug, ignoreId)) slug = `${base}-${n++}`;
    return slug;
  };

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // LIST: ?q= &tag= &status=published|draft|all &page= &limit=
  app.get("/api/posts", (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const status = ["draft", "published", "all"].includes(req.query.status) ? req.query.status : "published";
    const where = [], params = [];
    if (status !== "all") { where.push("p.status = ?"); params.push(status); }
    if (req.query.q) {
      where.push("(p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)");
      const like = `%${String(req.query.q).replace(/[%_]/g, "\\$&")}%`;
      params.push(like, like, like);
    }
    if (req.query.tag) {
      where.push("EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.name = ?)");
      params.push(String(req.query.tag).toLowerCase());
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = db.prepare(`SELECT COUNT(*) c FROM posts p ${clause}`).get(...params).c;
    const rows = db
      .prepare(`SELECT * FROM posts p ${clause} ORDER BY COALESCE(p.published_at, p.created_at) DESC, p.id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, (page - 1) * limit);
    res.json({ data: rows.map((r) => hydrate(r, false)), meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  });

  app.get("/api/tags", (_req, res) =>
    res.json({
      data: db.prepare(
        `SELECT t.name, COUNT(*) AS count FROM tags t JOIN post_tags pt ON pt.tag_id = t.id
         JOIN posts p ON p.id = pt.post_id AND p.status = 'published' GROUP BY t.id ORDER BY count DESC, t.name`
      ).all(),
    })
  );

  // READ by numeric id or slug
  app.get("/api/posts/:idOrSlug", (req, res) => {
    const row = findOne(req.params.idOrSlug);
    if (!row) return res.status(404).json({ error: "Post not found" });
    res.json({ data: hydrate(row, true) });
  });

  // CREATE
  app.post("/api/posts", requireKey, (req, res) => {
    const body = req.body || {};
    const errors = validate(body, false);
    if (errors.length) return res.status(400).json({ error: "Validation failed", details: errors });
    const status = body.status || "draft";
    const content = body.content || "";
    const info = db.prepare(
      `INSERT INTO posts (slug, title, excerpt, content, author, cover_image, status, read_minutes, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uniqueSlug(slugify(body.title)), body.title.trim(), body.excerpt || "", content, body.author || "Tactyqal",
      body.cover_image || null, status, readMinutes(content), status === "published" ? new Date().toISOString() : null
    );
    const id = Number(info.lastInsertRowid);
    setTags(id, body.tags || []);
    res.status(201).json({ data: hydrate(findOne(String(id)), true) });
  });

  // UPDATE (partial; PUT and PATCH behave the same)
  const update = (req, res) => {
    const row = findOne(req.params.idOrSlug);
    if (!row) return res.status(404).json({ error: "Post not found" });
    const body = req.body || {};
    const errors = validate(body, true);
    if (errors.length) return res.status(400).json({ error: "Validation failed", details: errors });
    const next = { ...row, ...Object.fromEntries(Object.entries(body).filter(([k]) => ["title", "excerpt", "content", "author", "cover_image", "status"].includes(k))) };
    if (body.title !== undefined) next.title = body.title.trim();
    if (body.title !== undefined && next.title !== row.title) next.slug = uniqueSlug(slugify(next.title), row.id);
    if (next.status === "published" && !row.published_at) next.published_at = new Date().toISOString();
    db.prepare(
      `UPDATE posts SET slug=?, title=?, excerpt=?, content=?, author=?, cover_image=?, status=?, read_minutes=?,
       published_at=?, updated_at=datetime('now') WHERE id=?`
    ).run(next.slug, next.title, next.excerpt, next.content, next.author, next.cover_image, next.status,
      readMinutes(next.content), next.published_at, row.id);
    if (body.tags !== undefined) setTags(row.id, body.tags);
    res.json({ data: hydrate(findOne(String(row.id)), true) });
  };
  app.put("/api/posts/:idOrSlug", requireKey, update);
  app.patch("/api/posts/:idOrSlug", requireKey, update);

  // DELETE
  app.delete("/api/posts/:idOrSlug", requireKey, (req, res) => {
    const row = findOne(req.params.idOrSlug);
    if (!row) return res.status(404).json({ error: "Post not found" });
    db.prepare("DELETE FROM posts WHERE id = ?").run(row.id);
    res.status(204).end();
  });

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}
