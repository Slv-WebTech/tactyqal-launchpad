import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { listenSafe } from "./helpers.js";

// Contract tests: every response must (a) use a status code declared in docs/openapi.json and
// (b) validate against the declared schema. Schemas use additionalProperties:false, so an
// accidentally leaked field (e.g. an internal column) fails the build.
const spec = JSON.parse(readFileSync(new URL("../../docs/openapi.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: "spec", components: spec.components });
const KEY = "contract-key-0123456789abcdef";

async function start() {
  const db = openDb(":memory:");
  const server = await listenSafe(createApp(db, { adminKey: KEY, allowOpenWrites: false }));
  const base = `http://localhost:${server.address().port}/api`;
  const call = async (method, path, { body, key = KEY, raw } = {}) => {
    const r = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(key ? { "x-admin-key": key } : {}) }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const text = await r.text();
    return { status: r.status, headers: r.headers, json: text ? JSON.parse(text) : undefined };
  };
  return { server, call };
}

function assertContract(method, template, res) {
  const op = spec.paths[template]?.[method.toLowerCase()];
  assert.ok(op, `${method} ${template} is not in the spec`);
  const declared = op.responses[String(res.status)];
  assert.ok(declared, `${method} ${template} returned undeclared status ${res.status}`);
  const schemaRef = declared.content?.["application/json"]?.schema;
  if (!schemaRef) return assert.equal(res.json, undefined, "no-content response must have no body");
  assert.match(res.headers.get("content-type") || "", /application\/json/);
  const validate = ajv.compile({ $ref: `spec#${schemaRef.$ref.slice(1)}` });
  assert.ok(validate(res.json), `${method} ${template} ${res.status} violates schema: ${JSON.stringify(validate.errors)}\nbody: ${JSON.stringify(res.json).slice(0, 300)}`);
}

test("every operation honours the OpenAPI contract (statuses + response schemas)", async () => {
  const { server, call } = await start();
  try {
    const checks = [];
    const run = async (method, template, path, opts, wantStatus) => {
      const res = await call(method, path, opts);
      assert.equal(res.status, wantStatus, `${method} ${path}`);
      assertContract(method, template, res);
      checks.push(`${method} ${template} ${res.status}`);
      return res;
    };
    await run("GET", "/health", "/health", {}, 200);
    await run("GET", "/ready", "/ready", {}, 200);
    const created = await run("POST", "/posts", "/posts", { body: { title: "Contract post", content: "## h\n\ntext", tags: ["a", "b"], status: "published", cover_image: "https://x.test/a.png" } }, 201);
    await run("POST", "/posts", "/posts", { body: { title: "Draft one" } }, 201);
    await run("POST", "/posts", "/posts", { body: {} }, 400);
    await run("POST", "/posts", "/posts", { body: { title: "x" }, key: "" }, 401);
    await run("POST", "/posts", "/posts", { body: { title: "x" }, key: "wrong-wrong-wrong-wrong-wrong" }, 401);
    await run("POST", "/posts", "/posts", { raw: "{bad json" }, 400);
    await run("POST", "/posts", "/posts", { body: { title: "big", content: "x".repeat(1_200_000) } }, 413);
    await run("GET", "/posts", "/posts?limit=2", {}, 200);
    await run("GET", "/posts", "/posts?status=all&q=contract&tag=a", {}, 200);
    await run("GET", "/posts", "/posts?page=999&limit=1", {}, 200);
    await run("GET", "/tags", "/tags", {}, 200);
    await run("GET", "/posts/{idOrSlug}", `/posts/${created.json.data.slug}`, {}, 200);
    await run("GET", "/posts/{idOrSlug}", `/posts/${created.json.data.id}`, {}, 200);
    await run("GET", "/posts/{idOrSlug}", "/posts/nope", {}, 404);
    await run("GET", "/posts/{idOrSlug}", "/posts/%E0%A4%A", {}, 400); // malformed percent-encoding
    await run("PUT", "/posts/{idOrSlug}", `/posts/${created.json.data.id}`, { body: { excerpt: "e", tags: ["z"] } }, 200);
    await run("PATCH", "/posts/{idOrSlug}", `/posts/${created.json.data.id}`, { body: { title: "Renamed" } }, 200);
    await run("PUT", "/posts/{idOrSlug}", `/posts/${created.json.data.id}`, { body: { status: "nope" } }, 400);
    await run("PUT", "/posts/{idOrSlug}", `/posts/${created.json.data.id}`, { body: {}, key: "" }, 401);
    await run("PUT", "/posts/{idOrSlug}", "/posts/99999", { body: { title: "x" } }, 404);
    await run("DELETE", "/posts/{idOrSlug}", `/posts/${created.json.data.id}`, { key: "" }, 401);
    await run("DELETE", "/posts/{idOrSlug}", `/posts/${created.json.data.id}`, {}, 204);
    await run("DELETE", "/posts/{idOrSlug}", `/posts/${created.json.data.id}`, {}, 404);
    // every operation in the spec was exercised at least once
    for (const [template, ops] of Object.entries(spec.paths)) for (const m of Object.keys(ops)) assert.ok(checks.some((c) => c.startsWith(`${m.toUpperCase()} ${template} `)), `spec operation ${m.toUpperCase()} ${template} has no contract test`);
  } finally { server.close(); }
});

test("contract: error bodies never leak internals (stack, SQL, file paths)", async () => {
  const { server, call } = await start();
  try {
    for (const res of [await call("POST", "/posts", { raw: "{bad" }), await call("GET", "/posts/%00"), await call("POST", "/posts", { body: {}, key: "" }), await call("GET", "/nope")]) {
      assert.doesNotMatch(JSON.stringify(res.json ?? ""), /\bat .*\.js:\d+|node_modules|SELECT |INSERT |sqlite|ERR_/i);
    }
  } finally { server.close(); }
});
