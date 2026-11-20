// Renders every raster brand asset from the SVG sources in docs/assets, plus README screenshots.
//   node scripts/generate-brand-assets.mjs [baseUrl]        (baseUrl = a running frontend with seeded API; default http://localhost:3600)
// Outputs: frontend/app/{favicon.ico,icon.svg,apple-icon.png,opengraph-image.png,twitter-image.png},
//          frontend/public/{icon-192.png,icon-512.png}, docs/assets/{social-preview.png,screenshots/*.png}
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = process.argv[2] || "http://localhost:3600";
const logoSvg = readFileSync(join(root, "docs/assets/logo.svg"), "utf8");
mkdirSync(join(root, "docs/assets/screenshots"), { recursive: true });
mkdirSync(join(root, "frontend/public"), { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });

// ---- icons: render the logo SVG at each size (transparent background keeps the rounded corners)
async function renderLogo(size) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${logoSvg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  return buf;
}
const png = Object.fromEntries(await Promise.all([16, 32, 48, 180, 192, 512].map(async (s) => [s, await renderLogo(s)])));

// ICO container with PNG payloads (supported by all modern browsers)
function ico(sizes) {
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const dir = [], data = [];
  for (const s of sizes) {
    const e = Buffer.alloc(16);
    e.writeUInt8(s === 256 ? 0 : s, 0); e.writeUInt8(s === 256 ? 0 : s, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(png[s].length, 8); e.writeUInt32LE(offset, 12);
    offset += png[s].length; dir.push(e); data.push(png[s]);
  }
  return Buffer.concat([head, ...dir, ...data]);
}
writeFileSync(join(root, "frontend/app/favicon.ico"), ico([16, 32, 48]));
copyFileSync(join(root, "docs/assets/logo.svg"), join(root, "frontend/app/icon.svg"));
writeFileSync(join(root, "frontend/app/apple-icon.png"), png[180]);
writeFileSync(join(root, "frontend/public/icon-192.png"), png[192]);
writeFileSync(join(root, "frontend/public/icon-512.png"), png[512]);

// ---- social card (Open Graph / Twitter / GitHub social preview)
const mark = logoSvg.replace("<svg ", '<svg width="150" height="150" ');
const card = (w, h) => `<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;
background:radial-gradient(900px 500px at 92% 0%,rgba(155,166,133,.55),transparent 60%),radial-gradient(800px 520px at 0% 110%,rgba(99,117,69,.9),transparent 60%),linear-gradient(135deg,#455230,#2f3920);color:#EBEBD8;position:relative">
<div style="position:absolute;inset:0;background-image:radial-gradient(rgba(235,235,216,.12) 1.2px,transparent 1.4px);background-size:30px 30px"></div>
<div style="position:absolute;right:-120px;top:-60px;width:620px;height:620px;border-radius:50%;border:2px solid rgba(155,166,133,.28)"></div>
<div style="position:absolute;right:-20px;top:40px;width:420px;height:420px;border-radius:50%;border:2px solid rgba(155,166,133,.22)"></div>
<div style="position:absolute;left:84px;top:${h * 0.16}px;display:flex;align-items:center;gap:28px">${mark}
 <div style="font-size:78px;font-weight:800;letter-spacing:-2px;background:linear-gradient(90deg,#EBEBD8,#9BA685);-webkit-background-clip:text;color:transparent">Tactyqal Labs</div></div>
<div style="position:absolute;left:84px;top:${h * 0.45}px;font-size:56px;font-weight:700;line-height:1.15;max-width:900px">Turn a teen's idea into a<br>launched app in <span style="color:#9BA685">8 weeks</span>.</div>
<div style="position:absolute;left:84px;bottom:${h * 0.1}px;display:flex;gap:14px;font-size:24px;font-weight:600">
 ${["Next.js 16", "Express + SQLite", "WCAG AA", "Tested end to end"].map((t) => `<span style="padding:10px 22px;border-radius:99px;background:rgba(235,235,216,.12);border:1px solid rgba(235,235,216,.38)">${t}</span>`).join("")}</div>
</body></html>`;
async function shot(html, w, h, out) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(html);
  await page.screenshot({ path: out });
  await page.close();
}
await shot(card(1200, 630), 1200, 630, join(root, "frontend/app/opengraph-image.png"));
copyFileSync(join(root, "frontend/app/opengraph-image.png"), join(root, "frontend/app/twitter-image.png"));
await shot(card(1280, 640), 1280, 640, join(root, "docs/assets/social-preview.png"));

// ---- README screenshots from the running app
async function snap(name, path, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: opts.scale || 1, isMobile: !!opts.mobile });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "*{transition:none!important;animation:none!important} html{scroll-behavior:auto!important}" });
  if (opts.scrollTo) { await page.evaluate((sel) => { const el = document.querySelector(sel); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }, opts.scrollTo); await page.waitForTimeout(300); }
  await page.screenshot({ path: join(root, "docs/assets/screenshots", name), fullPage: !!opts.full });
  await ctx.close();
}
await snap("home-desktop.png", "/", { width: 1440, height: 900 });
await snap("program-desktop.png", "/", { width: 1440, height: 760 }, { scrollTo: "#program" });
await snap("home-mobile.png", "/", { width: 390, height: 844 }, { mobile: true, scale: 2 });
await snap("blog-desktop.png", "/blog", { width: 1440, height: 900 });
await snap("post-desktop.png", "/blog/the-elevator-pitch-for-business-entrepreneurs", { width: 1440, height: 700 });
await snap("admin-desktop.png", "/admin", { width: 1440, height: 900 });

await browser.close();
console.log("brand assets generated");
