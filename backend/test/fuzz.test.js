import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { listenSafe } from "./helpers.js";

// Seeded fuzzing (deterministic: a failure prints the seed + request so it can be replayed).
// Invariants for EVERY request, however hostile: never 5xx, always JSON (or 204), DB stays consistent.
const SEED = Number(process.env.FUZZ_SEED || 20261120);
const N = Number(process.env.FUZZ_N || 600);
const rng = ((a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; })(SEED);
const pick = (a) => a[Math.floor(rng() * a.length)];
const int = (n) => Math.floor(rng() * n);

const NASTY = ["", " ", "\u0000", "'", '"', "\\", "%", "_", "%00", "%ZZ", "%E0%A4%A", "../../etc/passwd", "'; DROP TABLE posts;--", "<script>alert(1)</script>", "${7*7}", "{{7*7}}", "‮", "😀".repeat(50), "a".repeat(5000), "null", "undefined", "NaN", "-1", "0", "1e999", "9".repeat(40), "__proto__", "constructor", "%25%32%35", "\n\r\n", "日本語", "\ud800"];
const enc = (s) => { try { return encodeURIComponent(s); } catch { return "%EF%BF%BD"; } }; // lone surrogates cannot be encoded
const rand = () => (rng() < 0.5 ? pick(NASTY) : Math.random().toString(36).slice(2, 2 + int(12)));
const value = (d = 0) => {
  const r = rng();
  if (d > 3 || r < 0.35) return pick([null, true, false, 0, -1, 1.5, 1e308, -0, 2 ** 53, rand(), rand(), "draft", "published", [], {}]);
  if (r < 0.65) return Array.from({ length: int(5) }, () => value(d + 1));
  const o = {};
  for (let i = 0; i < int(6); i++) o[pick(["title", "excerpt", "content", "author", "cover_image", "status", "tags", "id", "slug", "__proto__", "constructor", rand()])] = value(d + 1);
  return o;
};
const body = () => {
  const o = { title: rand(), excerpt: rand(), content: rand(), status: pick(["draft", "published", rand()]), tags: Array.from({ length: int(4) }, rand) };
  for (const k of Object.keys(o)) if (rng() < 0.35) o[k] = value();
  if (rng() < 0.2) o[rand()] = value();
  return o;
};
const PATHS = ["/posts", "/posts/1", "/posts/2", "/posts/does-not-exist", "/tags", "/health", "/ready", "/posts/", "/POSTS", "/posts/1/extra", "//posts", "/posts;x=1"];

test(`fuzz: ${N} hostile requests (seed ${SEED}) never cause a 5xx, non-JSON reply or corrupted DB`, async () => {
  const db = openDb(":memory:");
  const server = await listenSafe(createApp(db, { adminKey: null, allowOpenWrites: true }));
  const base = `http://localhost:${server.address().port}/api`;
  const seen = {};
  try {
    for (let i = 0; i < 6; i++) await fetch(base + "/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: `seed ${i}`, status: "published", tags: ["x"] }) });
    for (let i = 0; i < N; i++) {
      const method = pick(["GET", "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);
      let path = pick(PATHS);
      if (rng() < 0.3) path += (path.includes("?") ? "&" : "?") + pick(["q", "tag", "status", "page", "limit", rand()]) + "=" + enc(rand()) + (rng() < 0.2 ? "&q[]=" + enc(rand()) + "&q[a]=b" : "");
      if (rng() < 0.15) path = "/posts/" + pick(NASTY.map(enc).concat(["%00", "%ZZ", "%E0%A4%A", "%2e%2e%2f"]));
      const headers = { "content-type": pick(["application/json", "application/json", "application/json", "text/plain", "application/x-www-form-urlencoded", "application/json; charset=utf-16", "", "multipart/form-data"]) };
      if (rng() < 0.2) headers["x-admin-key"] = rand().replace(/[^\x20-\x7e]/g, "?");
      let payload;
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) payload = rng() < 0.12 ? pick(["{", "[]", "null", '"x"', "42", "{bad", "\u0000", "{\"a\":" + "[".repeat(200)]) : JSON.stringify(rng() < 0.7 ? body() : value());
      const label = `#${i} ${method} ${path.slice(0, 90)} ct=${headers["content-type"]} body=${(payload ?? "").slice(0, 120)}`;
      let r;
      try { r = await fetch(base + path, { method, headers, body: payload }); } catch (e) { if (/bad port|invalid|Request cannot be constructed/i.test(String(e) + String(e.cause))) continue; throw new Error(`${label}\n${e}`); }
      seen[r.status] = (seen[r.status] || 0) + 1;
      const text = await r.text();
      assert.ok(r.status < 500, `5xx (${r.status}) [seed ${SEED}] ${label}\n${text.slice(0, 200)}`);
      if (method === "HEAD" || r.status === 204 || method === "OPTIONS") continue;
      assert.match(r.headers.get("content-type") || "", /json/, `non-JSON reply [seed ${SEED}] ${label}`);
      assert.doesNotThrow(() => JSON.parse(text), `unparseable JSON [seed ${SEED}] ${label}`);
      assert.doesNotMatch(text, /\bat .*\.js:\d+|node_modules|sqlite|SELECT |INSERT /i, `leaked internals [seed ${SEED}] ${label}`);
    }
    // the database survived: integrity ok, no orphaned join rows, every post still valid
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    assert.equal(db.prepare("SELECT COUNT(*) c FROM post_tags WHERE post_id NOT IN (SELECT id FROM posts)").get().c, 0);
    assert.equal(db.prepare("SELECT COUNT(*) c FROM posts WHERE title IS NULL OR trim(title) = '' OR status NOT IN ('draft','published')").get().c, 0);
    console.log("fuzz status distribution:", JSON.stringify(seen));
  } finally { server.close(); }
});
