import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

// Read-only contract check of the DEPLOYED API against docs/openapi.json (same schemas the unit-level contract test uses).
const API = process.env.LIVE_API || "https://tactyqal-launchpad-api.onrender.com/api";
const spec = JSON.parse(readFileSync(join(__dirname, "../../docs/openapi.json"), "utf8"));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: "spec", components: spec.components });

async function check(request, method, template, path, status, opts = {}) {
  const res = await request.fetch(API + path, { method, headers: { "content-type": "application/json" }, ...opts });
  expect(res.status(), `${method} ${path}`).toBe(status);
  const declared = spec.paths[template][method.toLowerCase()].responses[String(status)];
  expect(declared, `${method} ${template} -> ${status} must be declared in the spec`).toBeTruthy();
  const ref = declared.content?.["application/json"]?.schema?.$ref;
  if (ref) {
    const validate = ajv.compile({ $ref: `spec#${ref.slice(1)}` });
    const body = await res.json();
    expect(validate(body), `${method} ${path}: ${JSON.stringify(validate.errors)}`).toBe(true);
    return body;
  }
}

test.describe("live API contract (read-only)", () => {
  test.beforeAll(async ({ request }) => { await expect.poll(async () => (await request.get(`${API}/health`, { timeout: 60_000 })).status(), { timeout: 80_000, intervals: [2000] }).toBe(200); });

  test("GET endpoints return schema-valid bodies", async ({ request }) => {
    await check(request, "GET", "/health", "/health", 200);
    await check(request, "GET", "/ready", "/ready", 200);
    await check(request, "GET", "/tags", "/tags", 200);
    const list = await check(request, "GET", "/posts", "/posts?limit=50", 200);
    expect(list.data.length).toBeGreaterThan(0);
    for (const p of list.data) await check(request, "GET", "/posts/{idOrSlug}", `/posts/${p.slug}`, 200);
    await check(request, "GET", "/posts", "/posts?q=food&tag=ideas&page=1&limit=3", 200);
  });

  test("error responses are schema-valid and use declared statuses", async ({ request }) => {
    await check(request, "GET", "/posts/{idOrSlug}", "/posts/definitely-missing", 404);
    await check(request, "POST", "/posts", "/posts", 401, { data: { title: "x" } });
    await check(request, "PUT", "/posts/{idOrSlug}", "/posts/1", 401, { data: { title: "x" } });
    await check(request, "DELETE", "/posts/{idOrSlug}", "/posts/1", 401);
  });

  // Malformed percent-encoding that reaches the app must be a schema-valid 400, never a 500 (regression found by fuzzing).
  // Some forms (%ZZ, %00, a trailing incomplete "%A") are rejected earlier by the hosting edge (HTML 400 / Cloudflare 520),
  // so only truncated multi-byte sequences are used here: those are the ones the app itself decodes.
  test("malformed URL encoding reaching the app is a 400, not a 500", async ({ request }) => {
    await check(request, "GET", "/posts/{idOrSlug}", "/posts/%E0%A4", 400);
    await check(request, "GET", "/posts/{idOrSlug}", "/posts/%FF", 400);
  });
});
