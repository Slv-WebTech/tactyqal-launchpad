import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { listenSafe } from "./helpers.js";
process.env.ALLOW_OPEN_WRITES = "1"; // these suites exercise write paths without a key

async function start() {
  const db = openDb(":memory:");
  const server = await listenSafe(createApp(db));
  const base = `http://localhost:${server.address().port}/api`;
  const call = (path, method = "GET", body, headers = {}) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
  const make = async (b) => (await (await call("/posts", "POST", b)).json()).data;
  return { server, call, make, db };
}
const withApp = (name, fn) =>
  test(name, async () => {
    const ctx = await start();
    try { await fn(ctx); } finally { ctx.server.close(); }
  });

// ---------- slugs ----------
withApp("numeric title never becomes a slug that collides with an id", async ({ call, make }) => {
  const a = await make({ title: "First", status: "published" });
  const y = await make({ title: String(a.id + 1), status: "published" }); // title "2" -> must not shadow post id 2
  assert.ok(!/^\d+$/.test(y.slug), `slug ${y.slug} must not be purely numeric`);
  assert.equal((await (await call(`/posts/${y.slug}`)).json()).data.id, y.id);
});

withApp("non-latin and symbol-only titles still get a usable unique slug", async ({ call, make }) => {
  const a = await make({ title: "भारत में स्टार्टअप" });
  const b = await make({ title: "!!!???" });
  const c = await make({ title: "!!!???" });
  for (const p of [a, b, c]) assert.match(p.slug, /^[a-z0-9-]+$/);
  assert.equal(new Set([a.slug, b.slug, c.slug]).size, 3);
  assert.equal((await call(`/posts/${b.slug}`)).status, 200);
});

withApp("very long title is truncated to a sane slug; >200 chars rejected", async ({ call, make }) => {
  assert.ok((await make({ title: "a".repeat(200) })).slug.length <= 80);
  assert.equal((await call("/posts", "POST", { title: "a".repeat(201) })).status, 400);
});

withApp("renaming regenerates slug, keeps it unique, and a same-title save keeps slug", async ({ call, make }) => {
  const a = await make({ title: "Alpha" });
  const b = await make({ title: "Beta" });
  let r = await (await call(`/posts/${b.id}`, "PUT", { title: "Alpha" })).json();
  assert.equal(r.data.slug, "alpha-2");
  r = await (await call(`/posts/${a.id}`, "PUT", { title: "Alpha", excerpt: "x" })).json();
  assert.equal(r.data.slug, "alpha");
});

// ---------- validation ----------
withApp("rejects malformed bodies without 500", async ({ call }) => {
  for (const body of ['{"title": ', "not json", "[]", "null", '"str"', "42"]) {
    const r = await call("/posts", "POST", body);
    assert.ok(r.status === 400, `body ${body} -> ${r.status}`);
  }
});

withApp("rejects wrong types and empty titles", async ({ call }) => {
  const bad = [
    { title: 123 }, { title: "   " }, { title: "ok", excerpt: 5 }, { title: "ok", content: {} },
    { title: "ok", tags: "a,b" }, { title: "ok", status: "archived" }, { title: "ok", author: ["x"] },
    { title: "ok", excerpt: "e".repeat(501) }, { title: "ok", tags: [{ a: 1 }] }, { title: "ok", tags: [""] === 1 },
  ];
  for (const b of bad) {
    const r = await call("/posts", "POST", b);
    assert.equal(r.status, 400, JSON.stringify(b).slice(0, 60));
  }
});

withApp("oversized payloads return 413/400, never 500", async ({ call }) => {
  const r1 = await call("/posts", "POST", { title: "big", content: "x".repeat(200001) });
  assert.equal(r1.status, 400);
  const r2 = await call("/posts", "POST", { title: "huge", content: "x".repeat(1_200_000) });
  assert.equal(r2.status, 413);
  assert.ok((await r2.json()).error);
});

withApp("PUT/PATCH validation: empty title, bad status, unknown fields ignored", async ({ call, make }) => {
  const p = await make({ title: "Keep" });
  assert.equal((await call(`/posts/${p.id}`, "PUT", { title: "" })).status, 400);
  assert.equal((await call(`/posts/${p.id}`, "PATCH", { status: "nope" })).status, 400);
  const r = await (await call(`/posts/${p.id}`, "PATCH", { id: 999, slug: "hacked", created_at: "2000", read_minutes: 99, excerpt: "ok" })).json();
  assert.equal(r.data.id, p.id);
  assert.equal(r.data.slug, "keep");
  assert.equal(r.data.excerpt, "ok");
  assert.notEqual(r.data.read_minutes, 99);
});

// ---------- tags ----------
withApp("tags are trimmed, lowercased, deduped; replaced on update; kept when omitted", async ({ call, make }) => {
  const p = await make({ title: "T", tags: [" A ", "a", "B", "", "  "] });
  assert.deepEqual(p.tags, ["a", "b"]);
  let r = await (await call(`/posts/${p.id}`, "PUT", { excerpt: "no tag change" })).json();
  assert.deepEqual(r.data.tags, ["a", "b"]);
  r = await (await call(`/posts/${p.id}`, "PUT", { tags: ["c"] })).json();
  assert.deepEqual(r.data.tags, ["c"]);
  r = await (await call(`/posts/${p.id}`, "PUT", { tags: [] })).json();
  assert.deepEqual(r.data.tags, []);
});

withApp("/tags counts only published posts and drops empty tags", async ({ call, make }) => {
  await make({ title: "pub", status: "published", tags: ["x", "y"] });
  await make({ title: "draft", status: "draft", tags: ["x", "z"] });
  const tags = (await (await call("/tags")).json()).data;
  assert.deepEqual(tags.map((t) => [t.name, t.count]), [["x", 1], ["y", 1]]);
});

withApp("deleting a post cascades its tag links", async ({ call, make, db }) => {
  const p = await make({ title: "gone", tags: ["q"] });
  await call(`/posts/${p.id}`, "DELETE");
  assert.equal(db.prepare("SELECT COUNT(*) c FROM post_tags").get().c, 0);
});

// ---------- search / filter / pagination ----------
withApp("search treats % and _ literally and is injection-safe", async ({ call, make }) => {
  await make({ title: "100% organic", status: "published" });
  await make({ title: "plain title", status: "published" });
  await make({ title: "snake_case", status: "published" });
  const count = async (q) => (await (await call(`/posts?q=${encodeURIComponent(q)}`)).json()).meta.total;
  assert.equal(await count("%"), 1);
  assert.equal(await count("_"), 1);
  assert.equal(await count("100%"), 1);
  assert.equal(await count("' OR 1=1 --"), 0);
  assert.equal(await count("'; DROP TABLE posts; --"), 0);
  assert.equal((await (await call("/posts")).json()).meta.total, 3); // table intact
});

withApp("tag filter is case-insensitive and unknown tag yields empty list", async ({ call, make }) => {
  await make({ title: "a", status: "published", tags: ["Ideas"] });
  assert.equal((await (await call("/posts?tag=IDEAS")).json()).meta.total, 1);
  const r = await (await call("/posts?tag=nope")).json();
  assert.deepEqual(r.data, []);
  assert.equal(r.meta.pages, 0);
});

withApp("pagination bounds: junk, zero, negative, huge, beyond last page", async ({ call, make }) => {
  for (let i = 0; i < 25; i++) await make({ title: `Post ${i}`, status: "published" });
  const get = async (qs) => (await call(`/posts${qs}`)).json();
  assert.equal((await get("?limit=10")).data.length, 10);
  assert.equal((await get("?limit=0")).meta.limit, 10);
  assert.equal((await get("?limit=-5")).meta.limit, 1);
  assert.equal((await get("?limit=9999")).meta.limit, 50);
  assert.equal((await get("?limit=abc&page=xyz")).meta.page, 1);
  assert.equal((await get("?page=-3")).meta.page, 1);
  const last = await get("?limit=10&page=3");
  assert.equal(last.data.length, 5);
  assert.deepEqual((await get("?limit=10&page=99")).data, []);
  const ids = new Set();
  for (const pg of [1, 2, 3]) (await get(`?limit=10&page=${pg}`)).data.forEach((p) => ids.add(p.id));
  assert.equal(ids.size, 25, "no duplicates or gaps across pages");
});

withApp("list is newest-first and excludes content body", async ({ call, make }) => {
  const a = await make({ title: "old", status: "published", content: "SECRET BODY" });
  await new Promise((r) => setTimeout(r, 15));
  const b = await make({ title: "new", status: "published" });
  const { data } = await (await call("/posts")).json();
  assert.deepEqual(data.map((p) => p.id), [b.id, a.id]);
  assert.ok(!("content" in data[0]));
});

// ---------- lifecycle ----------
withApp("published_at: set on first publish, stable across edits and unpublish/republish", async ({ call, make }) => {
  const p = await make({ title: "lc" });
  assert.equal(p.published_at, null);
  const pub = (await (await call(`/posts/${p.id}`, "PUT", { status: "published" })).json()).data;
  assert.ok(pub.published_at);
  await new Promise((r) => setTimeout(r, 10));
  const edited = (await (await call(`/posts/${p.id}`, "PUT", { excerpt: "e" })).json()).data;
  assert.equal(edited.published_at, pub.published_at);
  await call(`/posts/${p.id}`, "PUT", { status: "draft" });
  const again = (await (await call(`/posts/${p.id}`, "PUT", { status: "published" })).json()).data;
  assert.equal(again.published_at, pub.published_at);
});

withApp("read_minutes recomputed from content (min 1)", async ({ call, make }) => {
  const p = await make({ title: "rm", content: "word ".repeat(1000) });
  assert.equal(p.read_minutes, 5);
  const r = (await (await call(`/posts/${p.id}`, "PUT", { content: "" })).json()).data;
  assert.equal(r.read_minutes, 1);
});

withApp("unicode, emoji and HTML are stored verbatim (escaping is the renderer's job)", async ({ call, make }) => {
  const p = await make({ title: "Émoji 🚀 <b>bold</b>", content: "<script>alert(1)</script> 日本語", author: "Zoë" });
  const got = (await (await call(`/posts/${p.id}`)).json()).data;
  assert.equal(got.title, "Émoji 🚀 <b>bold</b>");
  assert.equal(got.content, "<script>alert(1)</script> 日本語");
});

withApp("404s: unknown id/slug, double delete, unknown route, update of missing", async ({ call }) => {
  assert.equal((await call("/posts/999999")).status, 404);
  assert.equal((await call("/posts/does-not-exist")).status, 404);
  assert.equal((await call("/posts/999999", "PUT", { title: "x" })).status, 404);
  assert.equal((await call("/posts/999999", "DELETE")).status, 404);
  assert.equal((await call("/nope")).status, 404);
  assert.equal((await call("/posts/%00")).status, 404);
  assert.equal((await call("/posts/..%2F..%2Fetc%2Fpasswd")).status, 404);
});

withApp("slug and numeric-id lookups return the same post", async ({ call, make }) => {
  const p = await make({ title: "Dual Lookup" });
  const a = (await (await call(`/posts/${p.id}`)).json()).data;
  const b = (await (await call(`/posts/${p.slug}`)).json()).data;
  assert.deepEqual(a, b);
});

// ---------- concurrency ----------
withApp("20 concurrent creates with the same title all succeed with unique slugs", async ({ call }) => {
  const rs = await Promise.all(Array.from({ length: 20 }, () => call("/posts", "POST", { title: "Race" })));
  assert.ok(rs.every((r) => r.status === 201));
  const slugs = (await Promise.all(rs.map((r) => r.json()))).map((j) => j.data.slug);
  assert.equal(new Set(slugs).size, 20);
});

// ---------- auth ----------
test("ADMIN_KEY: writes AND draft access are protected; public reads stay open", async () => {
  process.env.ADMIN_KEY = "s3cret-key-for-tests-0123456789";
  const { server, call, db } = await start();
  const K = { "x-admin-key": "s3cret-key-for-tests-0123456789" };
  try {
    const draft = (await (await call("/posts", "POST", { title: "Draft" }, K)).json()).data;
    const pub = (await (await call("/posts", "POST", { title: "Pub", status: "published" }, K)).json()).data;
    for (const h of [{}, { "x-admin-key": "wrong" }, { "x-admin-key": "" }, { "X-ADMIN-KEY": "S3CRET-KEY-FOR-TESTS-0123456789" }]) {
      assert.equal((await call("/posts", "POST", { title: "x" }, h)).status, 401);
      assert.equal((await call(`/posts/${pub.id}`, "PUT", { title: "x" }, h)).status, 401);
      assert.equal((await call(`/posts/${pub.id}`, "DELETE", undefined, h)).status, 401);
    }
    // public can read published only
    assert.equal((await call(`/posts/${pub.slug}`)).status, 200);
    assert.equal((await call(`/posts/${draft.slug}`)).status, 404, "draft must not leak by slug");
    assert.equal((await call(`/posts/${draft.id}`)).status, 404, "draft must not leak by id");
    const listAll = await (await call("/posts?status=all")).json();
    assert.equal(listAll.meta.total, 1, "status=all without key only shows published");
    const asked = await (await call("/posts?status=draft")).json();
    assert.ok(asked.data.every((p) => p.status === "published"), "status=draft without key must not expose drafts");
    // with key: everything visible
    assert.equal((await call(`/posts/${draft.id}`, "GET", undefined, K)).status, 200);
    assert.equal((await (await call("/posts?status=all", "GET", undefined, K)).json()).meta.total, 2);
    assert.equal(db.prepare("SELECT COUNT(*) c FROM posts").get().c, 2, "rejected writes changed nothing");
  } finally { server.close(); delete process.env.ADMIN_KEY; }
});

withApp("health endpoint and CORS preflight for writes from another origin", async ({ call }) => {
  assert.equal((await call("/health")).status, 200);
  const r = await call("/posts", "OPTIONS", undefined, { origin: "https://example.com", "access-control-request-method": "PUT", "access-control-request-headers": "x-admin-key,content-type" });
  assert.ok(r.status === 204 || r.status === 200);
  assert.ok(r.headers.get("access-control-allow-methods")?.includes("PUT"));
  assert.ok(/x-admin-key/i.test(r.headers.get("access-control-allow-headers") || ""));
});
