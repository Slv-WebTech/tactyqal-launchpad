import test from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";

async function start() {
  const server = createApp(openDb(":memory:")).listen(0);
  const base = `http://localhost:${server.address().port}/api`;
  const call = (path, method = "GET", body, headers = {}) =>
    fetch(base + path, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { server, call };
}

test("CRUD lifecycle", async () => {
  const { server, call } = await start();
  try {
    let r = await call("/posts", "POST", { title: "Hello World!", content: "a b c", tags: ["Intro", "intro", "news"] });
    assert.equal(r.status, 201);
    const post = (await r.json()).data;
    assert.equal(post.slug, "hello-world");
    assert.deepEqual(post.tags, ["intro", "news"]);
    assert.equal(post.status, "draft");

    // drafts hidden from the default (public) list
    assert.equal((await (await call("/posts")).json()).meta.total, 0);
    assert.equal((await (await call("/posts?status=all")).json()).meta.total, 1);

    r = await call(`/posts/${post.id}`, "PUT", { status: "published", title: "Hello Again" });
    const upd = (await r.json()).data;
    assert.equal(upd.slug, "hello-again");
    assert.ok(upd.published_at);
    assert.equal((await (await call("/posts?tag=news&q=again")).json()).meta.total, 1);

    assert.equal((await call("/posts/hello-again")).status, 200);
    assert.equal((await call(`/posts/${post.id}`, "DELETE")).status, 204);
    assert.equal((await call(`/posts/${post.id}`)).status, 404);
  } finally { server.close(); }
});

test("validation and duplicate slugs", async () => {
  const { server, call } = await start();
  try {
    assert.equal((await call("/posts", "POST", {})).status, 400);
    assert.equal((await call("/posts", "POST", { title: "x", status: "bogus" })).status, 400);
    const a = (await (await call("/posts", "POST", { title: "Same" })).json()).data;
    const b = (await (await call("/posts", "POST", { title: "Same" })).json()).data;
    assert.notEqual(a.slug, b.slug);
  } finally { server.close(); }
});

test("ADMIN_KEY protects writes", async () => {
  process.env.ADMIN_KEY = "secret";
  const { server, call } = await start();
  try {
    assert.equal((await call("/posts", "POST", { title: "x" })).status, 401);
    assert.equal((await call("/posts", "POST", { title: "x" }, { "x-admin-key": "secret" })).status, 201);
    assert.equal((await call("/posts?status=all")).status, 200);
  } finally { server.close(); delete process.env.ADMIN_KEY; }
});
