import { test, expect } from "@playwright/test";

const WEB = process.env.LIVE_WEB || "https://tactyqal-launchpad.vercel.app";
const API = process.env.LIVE_API || "https://tactyqal-launchpad-api.onrender.com/api";

test.beforeAll(async ({ request }) => {
  // wake the free-tier API before anything else
  await expect.poll(async () => (await request.get(`${API}/health`, { timeout: 60_000 })).status(), { timeout: 80_000, intervals: [2000] }).toBe(200);
});

test.describe("live API (read-only)", () => {
  test("list shape, pagination meta, no content leakage in list", async ({ request }) => {
    const j = await (await request.get(`${API}/posts?limit=3`)).json();
    expect(j.data.length).toBeGreaterThan(0);
    expect(j.data.length).toBeLessThanOrEqual(3);
    expect(j.meta).toMatchObject({ page: 1, limit: 3 });
    expect(j.data[0]).not.toHaveProperty("content");
    expect(j.data[0].tags).toBeInstanceOf(Array);
  });

  test("single post by slug and id match; includes content", async ({ request }) => {
    const first = (await (await request.get(`${API}/posts?limit=1`)).json()).data[0];
    const bySlug = (await (await request.get(`${API}/posts/${first.slug}`)).json()).data;
    const byId = (await (await request.get(`${API}/posts/${first.id}`)).json()).data;
    expect(bySlug).toEqual(byId);
    expect(bySlug.content.length).toBeGreaterThan(0);
  });

  test("errors are JSON, never 500: 404s, bad paging, hostile search", async ({ request }) => {
    for (const [path, status] of [["/posts/nope-nope", 404], ["/posts/999999", 404], ["/nope", 404], ["/posts?page=abc&limit=-1", 200], [`/posts?q=${encodeURIComponent("'; DROP TABLE posts;--")}`, 200], ["/posts?q=%25", 200]]) {
      const r = await request.get(`${API}${path}`);
      if (r.status() === 403 && r.headers().server === "cloudflare") continue; // edge WAF blocked a hostile-looking query: fine
      expect(r.status(), path).toBe(status);
      expect(r.headers()["content-type"]).toContain("application/json");
    }
  });

  test("anonymous writes are rejected (401) and change nothing", async ({ request }) => {
    const before = (await (await request.get(`${API}/posts?status=all`)).json()).meta.total;
    const H = { "content-type": "application/json" };
    expect((await request.post(`${API}/posts`, { headers: H, data: { title: "anon" } })).status()).toBe(401);
    expect((await request.post(`${API}/posts`, { headers: { ...H, "x-admin-key": "wrong" }, data: { title: "anon" } })).status()).toBe(401);
    expect((await request.put(`${API}/posts/1`, { headers: H, data: { title: "hijack" } })).status()).toBe(401);
    expect((await request.delete(`${API}/posts/1`)).status()).toBe(401);
    expect((await (await request.get(`${API}/posts?status=all`)).json()).meta.total).toBe(before);
  });

  test("drafts are not readable anonymously (list, status=all)", async ({ request }) => {
    const all = await (await request.get(`${API}/posts?status=all&limit=50`)).json();
    expect(all.data.every((p) => p.status === "published")).toBe(true);
  });

  // Only runs when you pass the real key: LIVE_ADMIN_KEY=... npx playwright test -c live.config.js
  test("with the admin key: validation rejects bad writes WITHOUT creating data", async ({ request }) => {
    test.skip(!process.env.LIVE_ADMIN_KEY, "set LIVE_ADMIN_KEY to run authenticated live checks");
    const H = { "content-type": "application/json", "x-admin-key": process.env.LIVE_ADMIN_KEY };
    const before = (await (await request.get(`${API}/posts?status=all`, { headers: H })).json()).meta.total;
    for (const data of [{}, { title: "   " }, { title: 5 }, { title: "x", status: "bogus" }, { title: "x", tags: [{ a: 1 }] }])
      expect((await request.post(`${API}/posts`, { headers: H, data })).status(), JSON.stringify(data)).toBe(400);
    expect((await request.put(`${API}/posts/999999`, { headers: H, data: { title: "x" } })).status()).toBe(404);
    expect((await request.delete(`${API}/posts/999999`, { headers: H })).status()).toBe(404);
    expect((await (await request.get(`${API}/posts?status=all`, { headers: H })).json()).meta.total).toBe(before);
  });

  test("CORS allows the deployed frontend origin", async ({ request }) => {
    const r = await request.fetch(`${API}/posts`, { method: "OPTIONS", headers: { origin: WEB, "access-control-request-method": "GET" } });
    expect(r.status()).toBeLessThan(300);
    expect(r.headers()["access-control-allow-origin"]).toMatch(/\*|tactyqal/);
  });

  test("security headers sanity: no stack traces in errors", async ({ request }) => {
    const r = await request.post(`${API}/posts`, { headers: { "content-type": "application/json" }, data: "{bad" });
    expect([400, 401]).toContain(r.status());
    const body = await r.text();
    expect(body).not.toMatch(/at .*\.js:\d+|node_modules|SyntaxError/);
  });
});

test.describe("live site", () => {
  test("home renders, no console/page errors, blog preview loads from the API", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("impacts millions");
    await expect(page.locator("section#blog a[href^='/blog/']")).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test("blog list, search, post page and 404", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.locator("main a[href^='/blog/']").first()).toBeVisible();
    await page.goto("/blog?q=food");
    await expect(page.locator("main a[href^='/blog/']")).toHaveCount(1);
    await page.goto("/blog/30-startup-ideas-to-solve-food-waste-problems");
    await expect(page.locator("article h1")).toContainText("food waste");
    expect((await page.goto("/blog/definitely-not-a-post")).status()).toBe(404);
  });

  for (const [name, w] of [["320", 320], ["375", 375], ["768", 768], ["1440", 1440]]) {
    test(`no horizontal overflow @${name}px on every page`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      for (const p of ["/", "/blog", "/admin", "/blog/30-startup-ideas-to-solve-food-waste-problems"]) {
        await page.goto(p);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(over, `${p} overflow ${over}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test("admin page loads its post list from the live API (no writes)", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("ul.divide-y li").first()).toBeVisible();
    await expect(page.getByText(/Cannot reach the API/)).toHaveCount(0);
  });

  test("favicon served and all internal links resolve", async ({ page, request }) => {
    expect((await request.get(`${WEB}/icon.svg`)).status()).toBe(200);
    await page.goto("/");
    const hrefs = [...new Set(await page.$$eval("a[href^='/']", (as) => as.map((a) => a.getAttribute("href").split("#")[0] || "/")))];
    for (const h of hrefs) expect((await request.get(`${WEB}${h}`)).status(), h).toBeLessThan(400);
  });
});
