import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { listenSafe } from "./helpers.js";
import { loadConfig } from "../src/config.js";

async function start({ config, db = openDb(":memory:") } = {}) {
  const server = await listenSafe(createApp(db, config ?? { adminKey: null, allowOpenWrites: true }));
  const base = `http://localhost:${server.address().port}/api`;
  const call = (path, method = "GET", body, headers = {}) =>
    fetch(base + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const make = async (b, h) => (await (await call("/posts", "POST", b, h)).json()).data;
  return { server, call, make, db };
}
const withApp = (name, fn, opts) => test(name, async () => { const c = await start(opts); try { await fn(c); } finally { c.server.close(); } });

// ---- S1: closed by default ----
test("config: weak keys and production open-writes are refused; defaults are closed", () => {
  assert.throws(() => loadConfig({ ADMIN_KEY: "short" }), /ADMIN_KEY/);
  assert.throws(() => loadConfig({ NODE_ENV: "production", ADMIN_KEY: "x".repeat(23) }), /ADMIN_KEY/);
  assert.throws(() => loadConfig({ NODE_ENV: "production", ALLOW_OPEN_WRITES: "1" }), /ALLOW_OPEN_WRITES/);
  assert.deepEqual(loadConfig({}), { adminKey: null, production: false, allowOpenWrites: false }, "nothing set => closed");
  assert.equal(loadConfig({ ALLOW_OPEN_WRITES: "true" }).allowOpenWrites, false, "only the exact value 1 opens writes");
  assert.equal(loadConfig({ ALLOW_OPEN_WRITES: "1" }).allowOpenWrites, true);
  assert.equal(loadConfig({ ALLOW_OPEN_WRITES: "1", ADMIN_KEY: "x".repeat(24) }).allowOpenWrites, false, "a key always wins over open mode");
  assert.equal(loadConfig({ NODE_ENV: "production" }).allowOpenWrites, false, "production without a key runs read-only, it does not crash or open up");
});

withApp("with NO configuration at all: reads work, every write is rejected, drafts stay hidden", async ({ call, db, make }) => {
  // seed one draft + one published directly in the DB (the API can't create them in closed mode)
  db.exec("INSERT INTO posts(slug,title,status,published_at,sort_at) VALUES ('pub','Pub','published','2025-01-01T00:00:00.000Z','2025-01-01T00:00:00.000Z'), ('dr','Draft','draft',NULL,'2025-01-02T00:00:00.000Z')");
  assert.equal((await call("/posts")).status, 200);
  assert.equal((await call("/posts/pub")).status, 200);
  assert.equal((await call("/posts/dr")).status, 404, "draft hidden");
  assert.equal((await call("/posts?status=all")).headers.get("content-type").includes("json"), true);
  assert.equal((await (await call("/posts?status=all")).json()).meta.total, 1);
  for (const [method, path, body] of [["POST", "/posts", { title: "x" }], ["POST", "/posts", {}], ["PUT", "/posts/pub", { title: "x" }], ["PATCH", "/posts/pub", { title: "x" }], ["DELETE", "/posts/pub"]]) {
    for (const h of [{}, { "x-admin-key": "anything" }, { "x-admin-key": "" }]) {
      const r = await call(path, method, body, h);
      assert.equal(r.status, 401, `${method} ${path} with ${JSON.stringify(h)}`);
      assert.match((await r.json()).error, /disabled/);
    }
  }
  assert.equal(db.prepare("SELECT COUNT(*) c FROM posts").get().c, 2, "nothing changed");
  assert.equal(await make({ title: "nope" }), undefined);
}, { config: loadConfig({}) });

withApp("ALLOW_OPEN_WRITES=1 (dev opt-in) opens writes; a configured key overrides it", async ({ call }) => {
  assert.equal((await call("/posts", "POST", { title: "dev" })).status, 201);
}, { config: loadConfig({ ALLOW_OPEN_WRITES: "1" }) });

withApp("ADMIN_KEY + ALLOW_OPEN_WRITES together: key still required", async ({ call }) => {
  assert.equal((await call("/posts", "POST", { title: "x" })).status, 401);
}, { config: loadConfig({ ALLOW_OPEN_WRITES: "1", ADMIN_KEY: "z".repeat(24) }) });

withApp("anonymous and wrong-key writes are rejected; right key works; no state change", async ({ call, db }) => {
  const K = "k".repeat(32);
  for (const h of [{}, { "x-admin-key": "wrong" }, { "x-admin-key": "" }, { "x-admin-key": K + "x" }, { "x-admin-key": K.slice(1) }]) {
    assert.equal((await call("/posts", "POST", { title: "x" }, h)).status, 401);
  }
  assert.equal(db.prepare("SELECT COUNT(*) c FROM posts").get().c, 0);
  assert.equal((await call("/posts", "POST", { title: "x" }, { "x-admin-key": K })).status, 201);
}, { config: { adminKey: "k".repeat(32), production: true, allowOpenWrites: false } });

withApp("X-Powered-By is not advertised", async ({ call }) => {
  assert.equal((await call("/posts")).headers.get("x-powered-by"), null);
});

withApp("readiness endpoint checks the database", async ({ call }) => {
  assert.equal((await call("/ready")).status, 200);
});

// ---- L1: atomic writes ----
withApp("create rolls back the post when tag insert fails", async ({ call, db }) => {
  db.exec("CREATE TRIGGER boom BEFORE INSERT ON post_tags BEGIN SELECT RAISE(ABORT,'simulated failure'); END;");
  const r = await call("/posts", "POST", { title: "Orphan?", tags: ["x"] });
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: "Internal server error" }); // no internals leaked
  assert.equal(db.prepare("SELECT COUNT(*) c FROM posts").get().c, 0);
});

withApp("update rolls back every field when tag replacement fails", async ({ call, make, db }) => {
  const p = await make({ title: "Original", excerpt: "keep", tags: ["a"] });
  db.exec("CREATE TRIGGER boom BEFORE INSERT ON post_tags BEGIN SELECT RAISE(ABORT,'simulated failure'); END;");
  const r = await call(`/posts/${p.id}`, "PUT", { title: "Changed", excerpt: "changed", tags: ["b"] });
  assert.equal(r.status, 500);
  db.exec("DROP TRIGGER boom");
  const after = (await (await call(`/posts/${p.id}`)).json()).data;
  assert.equal(after.title, "Original");
  assert.equal(after.excerpt, "keep");
  assert.deepEqual(after.tags, ["a"], "old tags must survive a failed replace");
});

withApp("database stays usable after a rolled-back request (no stuck transaction)", async ({ call, make, db }) => {
  db.exec("CREATE TRIGGER boom BEFORE INSERT ON post_tags BEGIN SELECT RAISE(ABORT,'x'); END;");
  await call("/posts", "POST", { title: "fail", tags: ["x"] });
  db.exec("DROP TRIGGER boom");
  assert.ok((await make({ title: "works", tags: ["x"] })).id);
});

// ---- P1/L5: list ordering, query plan, deep-page speed ----
withApp("newest-first holds across drafts and published (mixed-format bug fixed)", async ({ call, make }) => {
  const pub = await make({ title: "Published first", status: "published" });
  await new Promise((r) => setTimeout(r, 15));
  const draft = await make({ title: "Draft created later" });
  const { data } = await (await call("/posts?status=all")).json();
  assert.deepEqual(data.map((p) => p.id), [draft.id, pub.id]);
  for (const p of data) assert.match(p.created_at, /^\d{4}-\d\d-\d\dT.*Z$/, "ISO timestamps everywhere");
});

withApp("sort_at is internal: never exposed in responses", async ({ call, make }) => {
  const p = await make({ title: "x", status: "published" });
  assert.ok(!("sort_at" in p));
  assert.ok(!("sort_at" in (await (await call("/posts")).json()).data[0]));
  assert.ok(!("sort_at" in (await (await call(`/posts/${p.id}`)).json()).data));
});

withApp("list query is index-ordered (no temp B-tree) and deep pages are fast", async ({ db, call }) => {
  db.exec("BEGIN");
  const ins = db.prepare("INSERT INTO posts(slug,title,content,status,published_at,sort_at) VALUES (?,?,?,?,?,?)");
  for (let i = 0; i < 20000; i++) { const t = new Date(Date.now() - i * 1000).toISOString(); ins.run(`s${i}`, `T${i}`, "word ".repeat(100), "published", t, t); }
  db.exec("COMMIT");
  const plan = db.prepare("EXPLAIN QUERY PLAN SELECT id FROM posts p WHERE p.status = 'published' ORDER BY p.sort_at DESC, p.id DESC LIMIT 10 OFFSET 19990").all().map((r) => r.detail).join(" | ");
  assert.doesNotMatch(plan, /TEMP B-TREE/);
  assert.match(plan, /idx_posts_list/);
  const t0 = performance.now();
  const r = await (await call("/posts?limit=10&page=1999")).json();
  const ms = performance.now() - t0;
  assert.equal(r.data.length, 10);
  assert.ok(ms < 150, `deep page took ${ms.toFixed(0)}ms (was ~240ms+ before, 2.4s under load)`);
});

// ---- P2/P3: no N+1, no re-preparing of fixed statements ----
test("list uses a constant number of statements regardless of page size; reads/writes don't re-prepare", async () => {
  const db = openDb(":memory:");
  let prepares = 0, execs = 0;
  const orig = db.prepare.bind(db);
  db.prepare = (sql) => {
    prepares++;
    const st = orig(sql);
    for (const m of ["get", "all", "run"]) { const f = st[m].bind(st); st[m] = (...a) => { execs++; return f(...a); }; }
    return st;
  };
  const { server, call, make } = await start({ db });
  try {
    for (let i = 0; i < 50; i++) await make({ title: `P${i}`, status: "published", tags: ["a", "b", "c"] });
    const counts = [];
    for (const limit of [3, 50]) { execs = 0; await call(`/posts?limit=${limit}`); counts.push(execs); }
    assert.equal(counts[0], counts[1], `statement executions must not grow with rows: ${counts}`);
    assert.ok(counts[0] <= 2);

    prepares = 0;
    await call("/posts/p0"); await call("/posts/p1"); await make({ title: "again", tags: ["a", "z"] });
    assert.equal(prepares, 0, "fixed statements are prepared once at startup");
  } finally { server.close(); }
});

withApp("tags come back sorted, parsed and de-duplicated in list and detail", async ({ call, make }) => {
  const p = await make({ title: "t", status: "published", tags: ["zeta", "Alpha", "alpha", "beta"] });
  assert.deepEqual(p.tags, ["alpha", "beta", "zeta"]);
  assert.deepEqual((await (await call("/posts")).json()).data[0].tags, ["alpha", "beta", "zeta"]);
});

// ---- migration of a pre-existing (old-schema) database ----
test("old databases are migrated: sort_at backfilled, index created, data intact", () => {
  const file = `${process.env.TEMP || "/tmp"}/old-schema-${process.pid}.db`;
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT 'Tactyqal', cover_image TEXT,
    status TEXT NOT NULL DEFAULT 'draft', read_minutes INTEGER NOT NULL DEFAULT 1, published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO posts(slug,title,status,published_at) VALUES ('a','A','published','2024-05-01T00:00:00.000Z');
    INSERT INTO posts(slug,title,status,created_at) VALUES ('b','B','draft','2025-01-02 03:04:05');`);
  old.close();
  const db = openDb(file);
  const rows = db.prepare("SELECT slug, sort_at FROM posts ORDER BY id").all();
  assert.equal(rows[0].sort_at, "2024-05-01T00:00:00.000Z");
  assert.equal(rows[1].sort_at, "2025-01-02T03:04:05.000Z");
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'idx_posts_list'").get());
  assert.doesNotThrow(() => openDb(file)); // idempotent: second open is a no-op
  db.close();
});
