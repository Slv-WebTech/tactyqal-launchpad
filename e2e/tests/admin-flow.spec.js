import { test, expect } from "@playwright/test";

const API = "http://localhost:4100/api";
const row = (page, title) => page.locator("ul.divide-y li", { hasText: title });

test.describe.configure({ mode: "serial" });

test.describe("admin: full create → publish → edit → delete journey", () => {
  const TITLE = "E2E Journey Post";

  test("create a draft: appears in admin, hidden from public site and public API", async ({ page, request }) => {
    await page.goto("/admin");
    await page.getByPlaceholder("Title").fill(TITLE);
    await page.getByPlaceholder("Excerpt").fill("Created by Playwright");
    await page.getByPlaceholder(/Content/).fill("## Heading\n\nSome **bold** text\n\n- one\n- two");
    await page.getByPlaceholder("Tags, comma separated").fill("e2e, Playwright ,e2e");
    await page.getByRole("button", { name: "Create post" }).click();
    await expect(page.getByText("Post created")).toBeVisible();
    await expect(row(page, TITLE)).toContainText("draft");
    await expect(page.getByPlaceholder("Title")).toHaveValue(""); // form reset

    await page.goto("/blog");
    await expect(page.getByText(TITLE)).toHaveCount(0);
    const list = await (await request.get(`${API}/posts`)).json();
    expect(list.data.some((p) => p.title === TITLE)).toBe(false);
    const res = await page.goto("/blog/e2e-journey-post");
    expect(res.status()).toBe(404);
  });

  test("publish via edit: now visible in list, post page renders markdown and tags", async ({ page }) => {
    await page.goto("/admin");
    await row(page, TITLE).getByRole("button", { name: "Edit" }).click();
    await expect(page.getByPlaceholder("Title")).toHaveValue(TITLE);
    await expect(page.getByPlaceholder("Tags, comma separated")).toHaveValue("e2e, playwright"); // normalized + deduped
    await page.locator("select").selectOption("published");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Post updated")).toBeVisible();
    await expect(row(page, TITLE)).toContainText("published");

    await page.goto("/blog?q=Journey");
    await expect(page.getByRole("link", { name: new RegExp(TITLE) })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(TITLE) }).click();
    await expect(page.locator("article h1")).toHaveText(TITLE);
    await expect(page.locator(".prose-post h2")).toHaveText("Heading");
    await expect(page.locator(".prose-post strong")).toHaveText("bold");
    await expect(page.locator(".prose-post li")).toHaveCount(2);
    await expect(page.locator("article")).toContainText("e2e");
  });

  test("rename: slug changes, old URL 404s, new URL works", async ({ page }) => {
    await page.goto("/admin");
    await row(page, TITLE).getByRole("button", { name: "Edit" }).click();
    await page.getByPlaceholder("Title").fill("E2E Renamed Post");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Post updated")).toBeVisible();
    expect((await page.goto("/blog/e2e-journey-post")).status()).toBe(404);
    expect((await page.goto("/blog/e2e-renamed-post")).status()).toBe(200);
  });

  test("cancel edit resets the form without saving", async ({ page }) => {
    await page.goto("/admin");
    await row(page, "E2E Renamed Post").getByRole("button", { name: "Edit" }).click();
    await page.getByPlaceholder("Title").fill("SHOULD NOT SAVE");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByPlaceholder("Title")).toHaveValue("");
    await expect(page.getByRole("heading", { name: "New post" })).toBeVisible();
    await expect(page.getByText("SHOULD NOT SAVE")).toHaveCount(0);
  });

  test("unpublish removes it from the public site again", async ({ page }) => {
    await page.goto("/admin");
    await row(page, "E2E Renamed Post").getByRole("button", { name: "Edit" }).click();
    await page.locator("select").selectOption("draft");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Post updated")).toBeVisible();
    expect((await page.goto("/blog/e2e-renamed-post")).status()).toBe(404);
  });

  test("delete: dismissing the confirm keeps it; accepting removes it everywhere", async ({ page, request }) => {
    await page.goto("/admin");
    page.once("dialog", (d) => d.dismiss());
    await row(page, "E2E Renamed Post").getByRole("button", { name: "Delete" }).click();
    await expect(row(page, "E2E Renamed Post")).toHaveCount(1);

    page.once("dialog", (d) => d.accept());
    await row(page, "E2E Renamed Post").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Post deleted")).toBeVisible();
    await expect(row(page, "E2E Renamed Post")).toHaveCount(0);
    const all = await (await request.get(`${API}/posts?status=all&limit=50`)).json();
    expect(all.data.some((p) => /E2E/.test(p.title))).toBe(false);
  });
});

test.describe("security: stored XSS cannot execute anywhere", () => {
  test("script/HTML in title, excerpt, content, tags, author is inert on every page", async ({ page, request }) => {
    const dialogs = [];
    page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
    await page.exposeFunction("__pwned", () => dialogs.push("pwned"));
    const payload = '<img src=x onerror="window.__pwned()"><script>window.__pwned()</script>';
    const r = await request.post(`${API}/posts`, {
      data: { title: `XSS ${payload}`, excerpt: payload, content: `## ${payload}\n\n${payload}\n\n- ${payload}`, author: payload, tags: [payload.slice(0, 40)], status: "published" },
    });
    expect(r.status()).toBe(201);
    const { slug, id } = (await r.json()).data;

    for (const path of ["/", "/blog", `/blog/${slug}`, "/admin"]) {
      await page.goto(path);
      await page.waitForTimeout(400);
    }
    // admin: load into the edit form (values go into inputs, not HTML)
    await page.goto("/admin");
    await page.locator("ul.divide-y li", { hasText: "XSS" }).getByRole("button", { name: "Edit" }).click();
    await page.waitForTimeout(300);
    expect(dialogs, "no script executed").toEqual([]);
    await page.goto(`/blog/${slug}`);
    await expect(page.locator(".prose-post h2")).toContainText("<img src=x"); // visible as text
    expect(await page.locator(".prose-post img, .prose-post script, article img").count()).toBe(0);
    await request.delete(`${API}/posts/${id}`);
  });
});

test.describe("scale & content edge cases", () => {
  test("pagination across pages with > page-size posts, no duplicates, next/prev links", async ({ page, request }) => {
    const ids = [];
    for (let i = 1; i <= 8; i++) {
      const r = await request.post(`${API}/posts`, { data: { title: `Paging ${String(i).padStart(2, "0")}`, status: "published", tags: ["paging"] } });
      ids.push((await r.json()).data.id);
    }
    await page.goto("/blog?tag=paging");
    await expect(page.locator("main a[href^='/blog/']")).toHaveCount(6);
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expect(page.getByRole("link", { name: /Newer/ })).toHaveCount(0);
    const first = await page.locator("main h3").allTextContents();
    await page.getByRole("link", { name: /Older/ }).click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await expect(page.locator("main a[href^='/blog/']")).toHaveCount(2);
    const second = await page.locator("main h3").allTextContents();
    expect(new Set([...first, ...second]).size).toBe(8);
    await expect(page.getByRole("link", { name: /Older/ })).toHaveCount(0);
    await page.getByRole("link", { name: /Newer/ }).click();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    for (const id of ids) await request.delete(`${API}/posts/${id}`);
  });

  test("very long title and unbroken string don't break the layout", async ({ page, request }) => {
    const long = "Supercalifragilistic".repeat(8);
    const r = await request.post(`${API}/posts`, { data: { title: long, excerpt: "x".repeat(400), content: "y".repeat(3000), status: "published" } });
    const { slug, id } = (await r.json()).data;
    for (const w of [320, 1280]) {
      await page.setViewportSize({ width: w, height: 800 });
      for (const path of ["/blog", `/blog/${slug}`]) {
        await page.goto(path);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(over, `${path}@${w} overflow ${over}px`).toBeLessThanOrEqual(0);
      }
    }
    await request.delete(`${API}/posts/${id}`);
  });

  test("unicode / emoji / RTL content renders", async ({ page, request }) => {
    const r = await request.post(`${API}/posts`, { data: { title: "नमस्ते 🚀 مرحبا", content: "## 日本語\n\nÉmoji 😀", status: "published" } });
    const { slug, id } = (await r.json()).data;
    await page.goto(`/blog/${slug}`);
    await expect(page.locator("article h1")).toHaveText("नमस्ते 🚀 مرحبا");
    await expect(page.locator(".prose-post h2")).toHaveText("日本語");
    await request.delete(`${API}/posts/${id}`);
  });

  test("post with empty content / no tags renders without errors", async ({ page, request }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const r = await request.post(`${API}/posts`, { data: { title: "Bare minimum", status: "published" } });
    const { slug, id } = (await r.json()).data;
    expect((await page.goto(`/blog/${slug}`)).status()).toBe(200);
    await expect(page.locator("article h1")).toHaveText("Bare minimum");
    expect(errors).toEqual([]);
    await request.delete(`${API}/posts/${id}`);
  });
});
