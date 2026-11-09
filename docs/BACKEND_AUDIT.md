# Backend Audit — Tactyqal Blog API

Scope: `backend/src/app.js`, `db.js`, `server.js` (Express 4 + `node:sqlite`), plus the live deployment on Render.
Method: code review **plus measurements**. Every finding is tagged **[verified]** (reproduced by a script against the real code or the live API) or **[reasoned]** (follows from the code but not triggered). Numbers come from a 5,000–20,000-row in-memory dataset on a laptop; treat them as relative, not absolute.

## Executive summary

| # | Finding | Risk | Status |
|---|---|---|---|
| S1 | Writes are **open to anyone** unless `ADMIN_KEY` is set. It is not set on the live API (anonymous POST + DELETE succeeded) | **Critical** | verified, live |
| P1 | List endpoint reads every post's full `content` and sorts with an expression that defeats its index: page 400 = **2.4 s, 20 req/s** vs 92 ms for page 1 | **High** | verified |
| L1 | Create/update/delete are not transactional: a failed tag insert leaves an orphan post | **High** | verified |
| S2 | No rate limiting, no security headers, `X-Powered-By` exposed, no brute-force protection on the admin key | Medium | verified |
| L2 | Lost updates: two editors overwrite each other silently | Medium | verified |
| L3 | `POST` is not idempotent: a client retry creates a duplicate (`retry-me-2`) | Medium | verified |
| P2/P3 | N+1 tag queries; 13 statements re-prepared per create | Medium | verified |
| P4 | Search is a full table scan (`LIKE '%q%'`): 110 req/s, p95 331 ms @ 5k rows | Medium | verified |
| S4 | `cover_image` accepts any string (`javascript:` URLs) | Medium | reasoned |
| L4 | Renaming a post breaks its old URL (no redirect history) | Medium | reasoned |
| L5 | Mixed date formats mis-order the admin list | Low | verified |
| A1/A2 | Fat route file; unique-constraint races surface as 500; no request IDs or structured logs | Medium | reasoned |
| P6 | SQLite file = single node: not horizontally scalable; Render free tier loses data on restart | Medium (by design) | reasoned |

Already good (checked, no action): all SQL is parameterised (only structural fragments are concatenated); update uses a field whitelist (no mass assignment); error responses are generic (no stack/SQL leak, verified with an injected DB failure); body size capped (413); drafts are hidden from non-admins; no outbound requests (no SSRF surface); the 26-test suite covers the validation edge cases.

---

## 1. Business Logic Validation

### L1 — Non-atomic writes
- **Core Issue:** `POST` runs `INSERT posts` then up to N×3 tag statements as separate auto-commits (13 prepares / 14 executions for a 3-tag post, no `BEGIN`). Any failure after the first insert leaves a half-written post. Verified: with a failing tag insert the API returned 500 **and the post row stayed in the table**. `PUT` has the same shape (row updated, then tags replaced).
- **Risk Level:** High
- **Refactored Code / Fix:**
```js
// backend/src/tx.js
export function tx(db, fn) {
  db.exec("BEGIN IMMEDIATE");           // take the write lock up-front: no lock-upgrade deadlocks
  try { const out = fn(); db.exec("COMMIT"); return out; }
  catch (e) { db.exec("ROLLBACK"); throw e; }
}

// in the create handler
const post = tx(db, () => {
  const info = stmts.insertPost.run(/* ... */);
  setTags(Number(info.lastInsertRowid), body.tags || []);
  return findById(Number(info.lastInsertRowid));
});
res.status(201).json({ data: post });
```
(Use `tx` in update and delete too. It also fixes the slug check-then-insert race, see A2.)
- **Test Script:**
```js
test("failed tag insert rolls back the post", async () => {
  const db = openDb(":memory:");
  db.exec("CREATE TRIGGER boom BEFORE INSERT ON post_tags BEGIN SELECT RAISE(ABORT,'x'); END;");
  const s = createApp(db).listen(0);
  const r = await fetch(`http://localhost:${s.address().port}/api/posts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "t", tags: ["a"] }) });
  assert.equal(r.status, 500);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM posts").get().c, 0);   // fails today (1)
  s.close();
});
```

### L2 — Lost updates (no optimistic concurrency)
- **Core Issue:** Editor A and B both load a post; B saves after A and silently erases A's edit (verified: final content = "editor B (stale)", no 409/412).
- **Risk Level:** Medium
- **Refactored Code / Fix:** add a `version` column and an `ETag`/`If-Match` contract.
```sql
ALTER TABLE posts ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
```
```js
// GET single → res.set("ETag", `"${row.version}"`)
const update = (req, res) => {
  const row = findOne(req.params.idOrSlug);
  if (!row) return notFound(res);
  const ifMatch = req.get("if-match");
  if (ifMatch && ifMatch !== `"${row.version}"`) return res.status(412).json({ error: "Post was modified by someone else; reload and retry" });
  const r = tx(db, () => stmts.updatePost.run(/* fields */, row.id, row.version)); // ...SET version=version+1 WHERE id=? AND version=?
  if (r.changes === 0) return res.status(409).json({ error: "Concurrent modification" });
  /* ... */
};
```
- **Test Script:**
```js
test("stale If-Match is rejected with 412", async () => {
  const p = await make({ title: "v" });
  const etag = (await call(`/posts/${p.id}`)).headers.get("etag");
  await call(`/posts/${p.id}`, "PUT", { content: "A" }, { "if-match": etag });
  const stale = await call(`/posts/${p.id}`, "PUT", { content: "B" }, { "if-match": etag });
  assert.equal(stale.status, 412);
});
```

### L3 — Non-idempotent create
- **Core Issue:** A network retry or double-click on "Create post" creates two posts (`retry-me`, `retry-me-2`; verified).
- **Risk Level:** Medium
- **Refactored Code / Fix:** `Idempotency-Key` header, stored in the same transaction as the insert.
```sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY, request_hash TEXT NOT NULL,
  status INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
```
```js
const sha = (v) => createHash("sha256").update(v).digest("hex");
app.post("/api/posts", requireKey, (req, res) => {
  const key = req.get("idempotency-key");
  const hash = sha(JSON.stringify(req.body));
  if (key) {
    const hit = db.prepare("SELECT * FROM idempotency_keys WHERE key = ?").get(key);
    if (hit) return hit.request_hash === hash
      ? res.status(hit.status).set("Idempotent-Replay", "true").type("json").send(hit.body)
      : res.status(422).json({ error: "Idempotency-Key reused with a different payload" });
  }
  const result = tx(db, () => {
    const post = createPost(req.body);                       // service layer
    if (key) db.prepare("INSERT INTO idempotency_keys(key,request_hash,status,body) VALUES (?,?,?,?)").run(key, hash, 201, JSON.stringify({ data: post }));
    return post;
  });
  res.status(201).json({ data: result });
});
// + a nightly job: DELETE FROM idempotency_keys WHERE created_at < datetime('now','-1 day')
```
- **Test Script:**
```js
test("same Idempotency-Key creates exactly one post", async () => {
  const h = { "idempotency-key": "abc-123" };
  const a = await (await call("/posts", "POST", { title: "Once" }, h)).json();
  const b = await call("/posts", "POST", { title: "Once" }, h);
  assert.equal(b.headers.get("idempotent-replay"), "true");
  assert.equal((await b.json()).data.id, a.data.id);
  assert.equal((await call("/posts", "POST", { title: "Different" }, h)).status, 422);
});
```

### L4 — Renaming breaks URLs (state/identity integrity)
- **Core Issue:** A title edit regenerates the slug; the old public URL then 404s (SEO loss, dead shared links). Tested behaviour today is "old slug 404".
- **Risk Level:** Medium
- **Refactored Code / Fix:** keep a redirect table; `findOne` falls back to it.
```sql
CREATE TABLE slug_redirects (old_slug TEXT PRIMARY KEY, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE);
```
```js
// on rename, inside the update tx
db.prepare("INSERT OR REPLACE INTO slug_redirects(old_slug, post_id) VALUES (?, ?)").run(row.slug, row.id);
// lookup
const bySlug = stmts.bySlug.get(s) ?? stmts.byOldSlug.get(s);           // JOIN slug_redirects
// respond 200 with the canonical post; the frontend does redirect(`/blog/${post.slug}`) if post.slug !== requested
```
- **Test Script:**
```js
test("old slug still resolves to the renamed post", async () => {
  const p = await make({ title: "Old Name", status: "published" });
  await call(`/posts/${p.id}`, "PUT", { title: "New Name" });
  const r = await (await call("/posts/old-name")).json();
  assert.equal(r.data.slug, "new-name");
});
```

### L5 — Mixed timestamp formats mis-sort the list
- **Core Issue:** `published_at` is ISO-8601 (`…T…Z`) but `created_at` is SQLite's `YYYY-MM-DD HH:MM:SS`. `ORDER BY COALESCE(published_at, created_at)` compares them as strings, and `'T' > ' '`, so on the same date a published post always outranks a *newer* draft. Verified: "Draft created later" sorted below "Published first".
- **Risk Level:** Low (admin list ordering), but it is the same expression that causes P1.
- **Refactored Code / Fix:** one canonical sort column, ISO everywhere (migration below in P1).
- **Test Script:** covered by the P1 test (`order is newest-first across statuses`).

### State machine notes
`draft ⇄ published` is the only workflow; `published_at` is set once and kept on unpublish/republish (tested, intentional). If scheduling or archiving is ever needed, encode the legal transitions in one table instead of scattered `if`s:
```js
const TRANSITIONS = { draft: ["published"], published: ["draft", "archived"], archived: ["draft"] };
if (next.status !== row.status && !TRANSITIONS[row.status]?.includes(next.status)) return res.status(409).json({ error: `Cannot go ${row.status} → ${next.status}` });
```
`DELETE` is a hard delete; consider `deleted_at` (soft delete) so a mis-click is recoverable.

---

## 2. System Design & Architectural Patterns

### P1 — List query: full-content reads + index-defeating sort
- **Core Issue:** `SELECT * FROM posts … ORDER BY COALESCE(published_at, created_at) DESC` (a) pulls every row's `content` (up to 200 KB each) through the sorter only to discard it in `hydrate`, and (b) the `COALESCE` expression cannot use `idx_posts_status_pub`, so SQLite builds a temp B-tree on every request (`USE TEMP B-TREE FOR ORDER BY`). `OFFSET` makes deep pages sort-and-skip.
  Measured through HTTP at 5,000 posts, 50 concurrent: page 1 = 513 req/s (p95 132 ms); **page 400 = 20 req/s (p50 2.45 s)**.
  Measured in SQL at 20,000 posts: `237 ms → 13.7 ms` (explicit columns) `→ 0.80 ms` (indexed sort column) `→ 0.03 ms` (keyset).
- **Risk Level:** High (a few crawler hits on deep pages stall the whole single-threaded process)
- **Refactored Code / Fix:**
```sql
-- migration
ALTER TABLE posts ADD COLUMN sort_at TEXT;
UPDATE posts SET sort_at = COALESCE(published_at, strftime('%Y-%m-%dT%H:%M:%fZ', created_at));
CREATE INDEX idx_posts_list ON posts(status, sort_at DESC, id DESC);
DROP INDEX IF EXISTS idx_posts_status_pub;
```
```js
// write path: sort_at = published_at ?? created_at, always ISO (set it in create/update)
const LIST_COLS = "p.id, p.slug, p.title, p.excerpt, p.author, p.cover_image, p.status, p.read_minutes, p.published_at, p.created_at, p.updated_at";

// offset pagination (keeps the current API): 0.8 ms at 20k rows
`SELECT ${LIST_COLS} FROM posts p ${clause} ORDER BY p.sort_at DESC, p.id DESC LIMIT ? OFFSET ?`

// keyset pagination (recommended for infinite scroll / crawlers): ?after=<sort_at>_<id>
`SELECT ${LIST_COLS} FROM posts p WHERE p.status = ? AND (p.sort_at, p.id) < (?, ?) ORDER BY p.sort_at DESC, p.id DESC LIMIT ?`
// → "SEARCH p USING COVERING INDEX", no temp B-tree
```
Also cap `page` (e.g. 1,000) or require keyset beyond it, and run `COUNT(*)` only when `?count=1`, since it scans the filtered set on every request.
- **Test Script:**
```js
test("list query uses the index and deep pages stay fast", () => {
  const db = openDb(":memory:"); bulkInsert(db, 20000);
  const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT id FROM posts p WHERE p.status='published' ORDER BY p.sort_at DESC, p.id DESC LIMIT 10 OFFSET 19990`).all().map(r => r.detail).join();
  assert.doesNotMatch(plan, /TEMP B-TREE/);
  const t = performance.now(); listPosts(db, { page: 1999, limit: 10 });
  assert.ok(performance.now() - t < 25);
});
test("order is newest-first across statuses", async () => { /* publish A, then create draft B later → B first */ });
```

### P2 — N+1 tag lookups
- **Core Issue:** `hydrate()` runs one `SELECT tags` per row: a 50-row page = 51+ queries (a 6-row list = 8 executions; verified). Cheap in-process on SQLite, but it becomes N network round trips the moment this moves to Postgres.
- **Risk Level:** Medium
- **Refactored Code / Fix:** aggregate in the same query.
```js
const TAGS_SQL = `COALESCE((SELECT json_group_array(name) FROM
   (SELECT t.name FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id ORDER BY t.name)), '[]') AS tags`;
// SELECT ${LIST_COLS}, ${TAGS_SQL} FROM posts p ...
rows.map(r => ({ ...r, tags: JSON.parse(r.tags) }));
```
- **Test Script:**
```js
test("list issues a constant number of statements regardless of page size", async () => {
  const counts = [];
  for (const n of [5, 50]) { const { db, call } = await appWithSpy(n); db.reset(); await call(`/posts?limit=${n}`); counts.push(db.executions); }
  assert.equal(counts[0], counts[1]);
});
```

### P3 — Statements re-prepared on every request
- **Core Issue:** `db.prepare()` is called inside handlers and loops (create = 13 prepares for 3 tags). Parsing/planning SQL on the hot path wastes CPU on a single-threaded server.
- **Risk Level:** Medium
- **Refactored Code / Fix:** prepare once in `createApp`.
```js
const stmts = {
  bySlug: db.prepare("SELECT * FROM posts WHERE slug = ?"),
  byId: db.prepare("SELECT * FROM posts WHERE id = ?"),
  insertPost: db.prepare("INSERT INTO posts (...) VALUES (...)"),
  insertTag: db.prepare("INSERT OR IGNORE INTO tags(name) VALUES (?)"),
  tagId: db.prepare("SELECT id FROM tags WHERE name = ?"),
  linkTag: db.prepare("INSERT INTO post_tags(post_id, tag_id) VALUES (?, ?)"),
  slugTaken: db.prepare("SELECT 1 FROM posts WHERE slug = ? AND id != ?"),
};
```
- **Test Script:** reuse the spy from P2: `assert.equal(prepareCountAfterBoot, prepareCountAfterTenRequests)`.

### P4 — Search is a full scan
- **Core Issue:** `LIKE '%q%'` over `title/excerpt/content` cannot use an index (`SCAN p`). Measured at 5,000 posts: **110 req/s, p95 331 ms**; cost grows linearly with data.
- **Risk Level:** Medium
- **Refactored Code / Fix:** SQLite FTS5 (available in this Node build; verified prefix + stemming).
```sql
CREATE VIRTUAL TABLE posts_fts USING fts5(title, excerpt, content, content='posts', content_rowid='id', tokenize='porter unicode61');
INSERT INTO posts_fts(posts_fts) VALUES('rebuild');
CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid,title,excerpt,content) VALUES (new.id,new.title,new.excerpt,new.content); END;
CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts,rowid,title,excerpt,content) VALUES('delete',old.id,old.title,old.excerpt,old.content); END;
CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts,rowid,title,excerpt,content) VALUES('delete',old.id,old.title,old.excerpt,old.content);
  INSERT INTO posts_fts(rowid,title,excerpt,content) VALUES (new.id,new.title,new.excerpt,new.content); END;
```
```js
// sanitise user input into quoted prefix terms: never pass raw text to MATCH (syntax errors / operator injection)
const ftsQuery = (q) => String(q).split(/\s+/).filter(Boolean).slice(0, 8).map(t => `"${t.replace(/"/g, '""')}"*`).join(" ");
where.push("p.id IN (SELECT rowid FROM posts_fts WHERE posts_fts MATCH ?)"); params.push(ftsQuery(req.query.q));
```
Behaviour change to communicate: matching becomes word-prefix (`food` finds `food waste`, `ood` does not).
- **Test Script:**
```js
test("search uses FTS and survives hostile input", async () => {
  await make({ title: "Food waste ideas", status: "published" });
  assert.equal((await (await call("/posts?q=food")).json()).meta.total, 1);
  for (const q of ['"', "AND OR NOT", "*", "foo(", "a'; DROP--"]) assert.equal((await call(`/posts?q=${encodeURIComponent(q)}`)).status, 200);
});
```

### P5 — Tag aggregation index
`/api/tags` scans `post_tags` and sorts with a temp B-tree. Cheap now; add `CREATE INDEX idx_post_tags_tag ON post_tags(tag_id, post_id);` and cache the response for 60 s.

### Caching & asynchronicity
- **Caching [reasoned]:** public `GET`s carry an `ETag` (Express default) but no `Cache-Control`. Add `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` for anonymous GETs and **`Vary: x-admin-key`** (responses differ for admins; otherwise a CDN can serve a draft to the public). Purge on write, or have the Next.js frontend use `revalidateTag` via a webhook.
- **Background work:** nothing in the current request path is heavy: `readMinutes` is O(n) on ≤200 KB. When these arrive, queue them instead of doing them in-request: image resizing for `cover_image`, sitemap/search re-indexing, email/webhook notifications, link-unfurl. Use an outbox table written inside the same `tx`, drained by a worker (BullMQ/SQS later); this gives at-least-once delivery without dual-write races.

---

## 3. Load Balancing & Performance

### P6 — Statefulness: the database is a local file
- **Core Issue [reasoned]:** the API process is stateless, but the state lives in `blog.db` on one machine. Two instances behind an ALB/Nginx would each have their own divergent database. On Render's free tier the file is also wiped on every restart/redeploy (known, accepted for the demo). `node:sqlite` is synchronous: every query blocks the event loop; SQLite allows one writer at a time.
- **Risk Level:** Medium for the demo; a blocker for horizontal scale.
- **Refactored Code / Fix:**
  1. Move to PostgreSQL (the schema is portable: `SERIAL`→`GENERATED ALWAYS AS IDENTITY`, `datetime('now')`→`now()`, `json_group_array`→`json_agg`, FTS5→`tsvector` + GIN).
  2. Use a pool and never hold a connection across `await`s of unrelated work: `new Pool({ max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 2_000 })`; `const c = await pool.connect(); try { … } finally { c.release(); }`.
  3. Behind the LB set `app.set("trust proxy", 1)` (otherwise rate limiting sees the LB's IP for everyone) and add liveness/readiness + graceful shutdown:
```js
app.get("/api/live", (_q, r) => r.json({ ok: true }));
app.get("/api/ready", (_q, r) => { try { db.prepare("SELECT 1").get(); r.json({ ok: true }); } catch { r.status(503).json({ ok: false }); } });

const server = app.listen(port);
let closing = false;
const shutdown = () => { if (closing) return; closing = true;
  server.close(() => { db.close(); process.exit(0); });   // stop accepting, drain in-flight, close DB
  setTimeout(() => process.exit(1), 10_000).unref(); };
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
process.on("unhandledRejection", (e) => { logger.error({ err: e }, "unhandledRejection"); });
```
  4. Set `server.keepAliveTimeout = 65_000; server.headersTimeout = 66_000;` (just above the ALB's 60 s idle timeout, to avoid intermittent 502s).
- **Test Script:**
```js
test("SIGTERM drains and exits 0", async () => {
  const child = spawn("node", ["src/server.js"], { env: { ...process.env, PORT: "4555", DB_FILE: ":memory:" } });
  await waitForHealth("http://localhost:4555/api/health");
  child.kill("SIGTERM");
  const [code] = await once(child, "exit");
  assert.equal(code, 0);
});
```

### Resource management & concurrency
- **Memory/streams [verified safe]:** no unbounded buffers: the JSON body is capped at 1 MB, list `limit` ≤ 50, no file downloads. No open DB handles leak (single handle, closed on shutdown after the fix above).
- **Concurrency [verified]:** 20 simultaneous creates with the same title all succeeded with unique slugs. That is only safe because the sync driver serialises handlers within **one** process. With Postgres or multiple processes, `uniqueSlug`'s check-then-insert becomes a race, so rely on the `UNIQUE` constraint and retry:
```js
function insertWithUniqueSlug(base, write) {
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    try { return tx(db, () => write(slug)); }
    catch (e) { if (!/UNIQUE constraint failed: posts\.slug/.test(e.message)) throw e; }
  }
  throw new AppError(409, "Could not allocate a unique slug");
}
```
- **Measured baseline (single node, 5k posts, c=50):** single post by slug 1,602 req/s (p95 47 ms); list page 1 513 req/s (p95 132 ms); search 110 req/s; deep page 20 req/s. After P1/P2/P3/P4 the list and search paths should land near the single-post figure.

---

## 4. MVC Architecture & Code Quality

### A1 — Fat route file
- **Core Issue:** `app.js` (168 lines) mixes HTTP parsing, validation, slug rules, SQL, tag persistence and response shaping in each handler; none of it can be unit-tested without HTTP. It is readable and consistent for the size, but it will not stay that way. **Grade: B** (clear naming, good tests; no linter config, no types, logic in controllers).
- **Risk Level:** Medium (maintainability)
- **Refactored Code / Fix:**
```
src/
  server.js              # boot, graceful shutdown
  app.js                 # express wiring only: middleware + routers
  config.js              # env parsing, fail-fast validation
  routes/posts.routes.js # path → controller
  controllers/posts.controller.js  # skinny: parse req → call service → shape res
  services/posts.service.js        # business rules: slug, publish transitions, idempotency, tx
  repositories/posts.repo.js       # all SQL, prepared once
  schemas/post.schema.js           # zod: one source of truth for validation
  errors.js              # AppError(status, code, message)
```
```js
// schemas/post.schema.js
import { z } from "zod";
const httpUrl = z.string().url().refine((u) => /^https?:\/\//.test(u), "must be http(s)");
export const createPost = z.object({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().max(500).default(""),
  content: z.string().max(200_000).default(""),
  author: z.string().trim().max(100).default("Tactyqal"),
  cover_image: httpUrl.nullish(),
  status: z.enum(["draft", "published"]).default("draft"),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
}).strict();                       // .strict() rejects unknown keys → no mass assignment, ever
export const updatePost = createPost.partial();

// controllers/posts.controller.js: skinny
export const create = (svc) => (req, res) => {
  const input = createPost.parse(req.body);              // ZodError → 400 via error middleware
  res.status(201).json({ data: svc.create(input, { idempotencyKey: req.get("idempotency-key") }) });
};
```
- **Test Script:** services take their repo as an argument, so they are unit-tested with no HTTP and no DB:
```js
test("publishing stamps published_at once", () => {
  const repo = fakeRepo({ get: () => ({ id: 1, status: "draft", published_at: null }) });
  const out = makePostsService(repo, () => "2026-01-01T00:00:00.000Z").update(1, { status: "published" });
  assert.equal(out.published_at, "2026-01-01T00:00:00.000Z");
});
```

### A2 — Error handling and observability
- **Core Issue:** (a) A `UNIQUE`/`CHECK` violation from a race becomes a generic 500 instead of 409; (b) `console.error(err)` has no request correlation; (c) no `uncaughtException`/`unhandledRejection` handlers; (d) 404 handlers and validation errors have different shapes (`{error}` vs `{error, details}`).
- **Risk Level:** Medium
- **Refactored Code / Fix:**
```js
export class AppError extends Error {
  constructor(status, code, message, details) { super(message); Object.assign(this, { status, code, details }); }
}
app.use((req, res, next) => { req.id = req.get("x-request-id") || randomUUID(); res.set("x-request-id", req.id); next(); });

app.use((err, req, res, _next) => {
  let e = err;
  if (err instanceof ZodError) e = new AppError(400, "VALIDATION_FAILED", "Validation failed", err.issues.map(i => `${i.path.join(".")}: ${i.message}`));
  else if (err.type === "entity.parse.failed") e = new AppError(400, "INVALID_JSON", "Invalid JSON body");
  else if (err.type === "entity.too.large") e = new AppError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
  else if (/UNIQUE constraint failed/.test(err.message)) e = new AppError(409, "CONFLICT", "Resource already exists");
  if (!(e instanceof AppError)) { logger.error({ err, reqId: req.id }, "unhandled"); e = new AppError(500, "INTERNAL", "Internal server error"); }
  res.status(e.status).json({ error: { code: e.code, message: e.message, details: e.details, requestId: req.id } });
});
```
(Keep the response envelope stable. If you change the shape, update the Next.js admin page, which reads `json.error` and `json.details`.)
- **Test Script:**
```js
test("errors share one shape and carry a request id; 500s leak nothing", async () => {
  const r = await call("/posts", "POST", "{bad");
  const j = await r.json();
  assert.equal(j.error.code, "INVALID_JSON");
  assert.ok(j.error.requestId && r.headers.get("x-request-id") === j.error.requestId);
});
```

---

## 5. Security Contract & Compliance

### S1 — Fail-open authentication  ⚠️ fix first
- **Core Issue:** `isAdmin = !process.env.ADMIN_KEY || header === key`. If the variable is missing, **everyone is admin**. Verified on the live API: an anonymous `POST /api/posts` returned an id and an anonymous `DELETE` returned 204 (I removed my probe post). Anyone who finds the URL can deface or wipe the blog and read drafts. Also: the comparison is not constant-time, a single static shared secret gives no per-user attribution/RBAC, and there is no brute-force throttle.
- **Risk Level:** **Critical** (live deployment)
- **Refactored Code / Fix:** fail closed in production, constant-time compare.
```js
// config.js
export function loadConfig(env = process.env) {
  const adminKey = env.ADMIN_KEY || null;
  if (env.NODE_ENV === "production" && (!adminKey || adminKey.length < 24))
    throw new Error("ADMIN_KEY (>= 24 chars) is required when NODE_ENV=production");   // refuse to boot
  return { adminKey };
}
// auth.js
import { createHash, timingSafeEqual } from "node:crypto";
const digest = (s) => createHash("sha256").update(String(s ?? "")).digest();
export const makeAuth = ({ adminKey }) => {
  const isAdmin = (req) => adminKey === null ? process.env.NODE_ENV !== "production" : timingSafeEqual(digest(req.get("x-admin-key")), digest(adminKey));
  const requireAdmin = (req, res, next) => isAdmin(req) ? next() : res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or missing admin key" } });
  return { isAdmin, requireAdmin };
};
```
**Operational fix for the live site (needs your OK, see summary):** set `ADMIN_KEY` (random 32+ chars) and `NODE_ENV=production` on Render. The admin page already has a key field. Longer term: real users with roles (`editor`, `admin`) via JWT/OIDC, a `created_by` column, and authorisation checks on every mutation (ownership for editors). BOLA/IDOR is currently **not applicable** because there is one tenant and no per-user resources; draft visibility is enforced (tested).
- **Test Script:**
```js
test("production refuses to boot without a strong ADMIN_KEY", () => {
  assert.throws(() => loadConfig({ NODE_ENV: "production" }), /ADMIN_KEY/);
  assert.throws(() => loadConfig({ NODE_ENV: "production", ADMIN_KEY: "short" }), /ADMIN_KEY/);
  assert.doesNotThrow(() => loadConfig({ NODE_ENV: "production", ADMIN_KEY: "x".repeat(32) }));
});
// live canary (read-only-safe: expects rejection, creates nothing)
test("LIVE: anonymous writes are rejected", async () => {
  assert.equal((await fetch(`${API}/posts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "x" }) })).status, 401);
});
```

### S2 — No rate limiting / security headers / fingerprinting
- **Core Issue:** no throttling anywhere (verified: no `RateLimit-*` headers): writes and key-guessing are unlimited, and the Render free instance can be knocked over by a loop on the search endpoint. `X-Powered-By: Express` is advertised; no `X-Content-Type-Options`, HSTS or CSP (verified). CORS is `*` (fine for a public read API with header-key auth and no cookies, but writes should be restricted to known origins).
- **Risk Level:** Medium
- **Refactored Code / Fix:**
```js
import helmet from "helmet"; import rateLimit from "express-rate-limit";
app.disable("x-powered-by");
app.set("trust proxy", 1);                                   // behind Render/ALB, so limits key on the real client IP
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));  // JSON API: lock everything down
app.use(cors({ origin: (o, cb) => cb(null, !o || ALLOWED_ORIGINS.includes(o)), methods: ["GET","POST","PUT","PATCH","DELETE"], allowedHeaders: ["content-type","x-admin-key","if-match","idempotency-key"] }));

const readLimiter  = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 30,  standardHeaders: true, legacyHeaders: false });
const authFailures = rateLimit({ windowMs: 15 * 60_000, limit: 10, skipSuccessfulRequests: true, standardHeaders: true });  // 10 bad keys / 15 min / IP
app.use("/api", (req, res, next) => (req.method === "GET" ? readLimiter : writeLimiter)(req, res, next));
app.use("/api/posts", authFailures);
```
(For several instances the limiter needs a shared store, e.g. Redis, or the limit is per-node.)
- **Test Script:**
```js
test("write rate limit returns 429 with Retry-After", async () => {
  let last;
  for (let i = 0; i < 31; i++) last = await call("/posts", "POST", {});
  assert.equal(last.status, 429);
  assert.ok(last.headers.get("retry-after"));
});
test("no X-Powered-By; nosniff set", async () => {
  const r = await call("/posts");
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});
```

### S4 — Unvalidated `cover_image`
- **Core Issue [reasoned]:** any string ≤ 500 chars is accepted, including `javascript:alert(1)` and `file:///…`. The current frontend does not render it, so it is latent: a future `<img src>`/`<a href>`/server-side image fetch would turn it into XSS or SSRF.
- **Risk Level:** Medium
- **Refactored Code / Fix:** `httpUrl` schema above. If the server ever fetches it, also block private ranges (`10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1`) *after DNS resolution* and disable redirects.
- **Test Script:**
```js
test("cover_image must be an http(s) URL", async () => {
  for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,<script>", "not a url"])
    assert.equal((await call("/posts", "POST", { title: "t", cover_image: bad })).status, 400);
  assert.equal((await call("/posts", "POST", { title: "t", cover_image: "https://cdn.example.com/a.png" })).status, 201);
});
```

### Input sanitisation & disclosure: results
- **SQL injection:** safe; every user value is bound. The only interpolated pieces are fixed fragments (`clause`), and the e2e/unit suites include `'; DROP TABLE posts; --`.
- **XSS:** the API stores raw text and never renders HTML; the Next.js renderer escapes before formatting (7 unit tests + an e2e test with live payloads). Defence in depth: the CSP above.
- **Mass assignment:** whitelisted today; `.strict()` zod makes it structural.
- **Information disclosure [verified]:** 500s return `{"error":"Internal server error"}` even when the DB error mentions the trigger/table; no stack traces. Numeric IDs are sequential (enumerable), which is acceptable for public posts but means *draft* IDs must stay admin-only (they are). `x-powered-by` is the one fingerprint to drop (S2).

---

## 6. Fast & Effective Execution (Testing Blueprint)

### Mocking strategy
- **Database:** don't mock it. `openDb(":memory:")` is a real SQLite and starts in < 1 ms; the 26 existing API tests run in ~0.5 s total. Mock only at *boundaries you own*: inject a `clock` and `idGenerator` into services (deterministic `published_at`, request IDs).
- **Fault injection without mocks:** SQLite triggers (`RAISE(ABORT)`) simulate write failures deterministically (used in L1).
- **External services (future: email, storage, search, payment):** wrap each behind a small interface (`mailer.send`, `storage.put`) and pass a fake in tests. For raw HTTP use `undici`'s `MockAgent` (`setGlobalDispatcher(new MockAgent())`, `.intercept({ path, method }).reply(200, body)`), and `disableNetConnect()` so an un-mocked call fails loudly instead of hitting the network.
- **Time and concurrency:** `node:test` `mock.timers` for TTLs/idempotency expiry; `Promise.all` of N requests for race tests (as in the existing 20-concurrent-create test).
- **Layers:** services (pure, fake repo) → repositories (real in-memory SQLite) → HTTP (supertest-style `fetch` on port 0) → browser e2e. Keep the slow layers thin.

### Test case matrix
**Unit** (services/validators, no I/O, ms each)
- Happy: create applies defaults; publish stamps `published_at` once; slug generation (unicode, numeric, symbols, 80-char cap); `readMinutes` min 1.
- Strict errors: every schema field × (wrong type, empty, too long, unknown key → 400); illegal state transition → 409; `If-Match` mismatch → 412; reused `Idempotency-Key` with different body → 422; `cover_image` non-http → 400.
- Auth: constant-time compare equal/unequal/empty/undefined; production config refuses weak/missing key.

**Integration** (HTTP + in-memory SQLite)
- CRUD lifecycle; slug rename + redirect; tag replace/keep/clear; cascade delete; draft privacy by id/slug/list/`status=all`; pagination bounds; FTS hostile input; tx rollback via trigger; 20 concurrent creates; idempotent replay under `Promise.all`; 413/400/404/405 shapes; CORS preflight allow-list; 429 after limit; graceful-shutdown exit code; query-plan assertions (no `TEMP B-TREE`, no `SCAN` on list/search).

**End-to-end** (already in repo: 36 Playwright + 14 live smoke)
- Admin create→publish→rename→unpublish→delete; XSS inertness; API-down and 500 UX; no overflow at 4 widths. Add: the live canary "anonymous POST → 401" once S1 is deployed.

**Load / stress (k6):** `k6 run -e BASE_URL=https://<load-balancer> load.js`
```js
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
const BASE = __ENV.BASE_URL, KEY = __ENV.ADMIN_KEY;
const created = new Counter("created_posts");

export const options = {
  scenarios: {
    readers: { executor: "ramping-arrival-rate", exec: "read", startRate: 50, timeUnit: "1s",
      preAllocatedVUs: 100, maxVUs: 500,
      stages: [{ target: 200, duration: "1m" }, { target: 600, duration: "3m" }, { target: 600, duration: "2m" }, { target: 0, duration: "30s" }] },
    writers: { executor: "constant-arrival-rate", exec: "write", rate: 5, timeUnit: "1s", duration: "6m30s", preAllocatedVUs: 20 },
    deep_pages: { executor: "constant-arrival-rate", exec: "deepPage", rate: 10, timeUnit: "1s", duration: "6m30s", preAllocatedVUs: 20 },
  },
  thresholds: {
    "http_req_duration{scenario:readers}": ["p(95)<200", "p(99)<500"],
    "http_req_duration{scenario:deep_pages}": ["p(95)<250"],      // fails today (p50 ≈ 2.4 s at 5k posts)
    "http_req_failed": ["rate<0.01"],
    "checks": ["rate>0.99"],
  },
};

export function read() {
  const r = http.get(`${BASE}/api/posts?limit=10&page=${1 + Math.floor(Math.random() * 5)}`);
  check(r, { "200": (x) => x.status === 200, "has data": (x) => x.json("data").length > 0 });
  const slug = r.json("data.0.slug");
  if (slug) check(http.get(`${BASE}/api/posts/${slug}`), { "post 200": (x) => x.status === 200 });
  sleep(0.2);
}
export function deepPage() {
  check(http.get(`${BASE}/api/posts?limit=10&page=${100 + Math.floor(Math.random() * 300)}`), { "deep 200": (x) => x.status === 200 });
}
export function write() {
  const key = `${__VU}-${__ITER}`;
  const params = { headers: { "content-type": "application/json", "x-admin-key": KEY, "idempotency-key": key } };
  const body = JSON.stringify({ title: `load ${key}`, content: "word ".repeat(200), status: "published", tags: ["load"] });
  const a = http.post(`${BASE}/api/posts`, body, params);
  const b = http.post(`${BASE}/api/posts`, body, params);            // retry: must NOT create a duplicate
  check(a, { "created": (x) => x.status === 201 });
  check(b, { "replayed": (x) => x.headers["Idempotent-Replay"] === "true" });
  if (a.status === 201) { created.add(1); http.del(`${BASE}/api/posts/${a.json("data.id")}`, null, params); }
}
```
Run it as three passes: (1) **baseline** on one instance to find the knee; (2) **soak** at 60 % of the knee for 30 min and watch RSS/event-loop lag (`perf_hooks.monitorEventLoopDelay`) for leaks; (3) **spike**: 10× arrival rate for 60 s then verify recovery. Behind a load balancer, add a statelessness check: `docker compose up --scale api=3` + Postgres, run `write` and `read` against the LB, and assert every written post is readable from *every* instance. This only passes after P6.

---

## Fix status (applied)

| Finding | Status | Evidence |
|---|---|---|
| S1 fail-open auth | **Fixed in code** (production refuses to boot without a >=24-char `ADMIN_KEY`; constant-time compare). **Live API still needs the env vars set on Render** (see README "Deploying") | `hardening.test.js` (auth, config); live canary in `e2e/live/smoke.spec.js` |
| P1 list query / deep pages | **Fixed** (`sort_at` ISO column, `idx_posts_list`, no `content` read in lists, auto-migration for old DBs) | deep page (page 400, 5k posts): **p50 2.3 s -> ~45 ms, 4 -> ~210 req/s**; plan test: no temp B-tree |
| P2 N+1 tags | **Fixed** (tags aggregated in the same query) | list = 2 statements for 3 or 50 rows (was 8 for 6 rows, 51+ for 50) |
| P3 re-preparing statements | **Fixed** for fixed statements (prepared once) | test: 0 prepares for reads/creates after startup |
| L1 atomic writes | **Fixed** (`BEGIN IMMEDIATE`/`ROLLBACK` around create and update) | trigger-based failure tests: no orphan post, old tags survive a failed update |
| L5 mixed timestamps | **Fixed** (ISO everywhere) | newest-first test across drafts and published |
| S2 (partial) | `X-Powered-By` removed, `/api/ready` and graceful shutdown added; **rate limiting and helmet not applied** | rate limits could throttle the e2e suite; recommend adding with a shared store |
| L2, L3, L4, S4, P4, P6, A1, A2 | **Not applied** (design decisions or larger refactors); fixes are above | n/a |

Single-post lookups were checked for regressions: HTTP numbers on this machine swing 6x between runs of the *same* code, so I compared the query directly: 5.1-5.3 us (old) vs 4.5-4.9 us (new).

## Recommended order of work
1. **S1** (minutes, operational): set `ADMIN_KEY` + `NODE_ENV=production` on Render, then deploy the fail-closed config.
2. **P1 + P2 + P3** (about one hour, biggest measured win: deep page 237 ms → 0.03 ms in SQL).
3. **L1** (transactions) and **S2** (helmet, rate limits).
4. **L2/L3** (ETag, idempotency), **S4** (URL validation), **P4** (FTS5).
5. **A1/A2** refactor into layers + zod + structured errors, **P6** Postgres when horizontal scale is actually needed.

Reproduce the measurements: the probe scripts used for this audit are plain Node (`audit-probe.mjs`, `audit-fix-bench.mjs`, `audit-verify2.mjs`) and can be added to the repo under `backend/bench/` on request.
