// Core Web Vitals + payload budget against a running site. Usage: node perf/vitals.mjs [baseUrl]
// Mobile profile: 375x812, 4x CPU slowdown, "Fast 4G" (9 Mbps down, 150 ms RTT). Median of 5 runs.
import { chromium } from "@playwright/test";

const BASE = process.argv[2] || "https://tactyqal-launchpad.vercel.app";
const PAGES = ["/", "/blog", "/blog/the-elevator-pitch-for-business-entrepreneurs", "/admin"];
const RUNS = 5;

const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const browser = await chromium.launch({ channel: "chrome" });

async function measure(path, mobile) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.clearBrowserCache");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (mobile) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });
  }
  await page.addInitScript(() => {
    window.__v = { lcp: 0, cls: 0, longTasks: [] };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.longTasks.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true });
  });
  await page.goto(BASE + path, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    const res = performance.getEntriesByType("resource");
    const sum = (f) => res.filter(f).reduce((s, e) => s + (e.transferSize || 0), 0);
    // Total Blocking Time (approx.): long-task time beyond 50 ms between FCP and 5 s after
    const tbt = window.__v.longTasks.filter(([s]) => s > fcp).reduce((t, [, d]) => t + Math.max(0, d - 50), 0);
    return {
      ttfb: nav.responseStart, fcp, lcp: window.__v.lcp, cls: window.__v.cls, tbt,
      load: nav.loadEventEnd, requests: res.length + 1,
      htmlKB: nav.transferSize / 1024, jsKB: sum((e) => e.initiatorType === "script" || /\.js(\?|$)/.test(e.name)) / 1024, cssKB: sum((e) => /\.css(\?|$)/.test(e.name)) / 1024,
      totalKB: (nav.transferSize + sum(() => true)) / 1024, dom: document.getElementsByTagName("*").length,
    };
  });
  await ctx.close();
  return r;
}

const rows = [];
for (const mobile of [true, false]) for (const path of PAGES) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await measure(path, mobile));
  const m = (k) => med(runs.map((r) => r[k]));
  rows.push({ profile: mobile ? "mobile (4x CPU, 4G)" : "desktop", path, TTFB: m("ttfb"), FCP: m("fcp"), LCP: m("lcp"), CLS: m("cls"), TBT: m("tbt"), requests: m("requests"), totalKB: m("totalKB"), jsKB: m("jsKB"), cssKB: m("cssKB"), dom: m("dom") });
}
await browser.close();

const f = (n, d = 0) => Number(n).toFixed(d);
console.log(`Base: ${BASE}   (median of ${RUNS} cold-cache runs)\n`);
console.log("profile".padEnd(21), "page".padEnd(52), "TTFB  FCP   LCP   CLS    TBT  reqs  total  js    css  DOM");
for (const r of rows) console.log(r.profile.padEnd(21), r.path.padEnd(52), `${f(r.TTFB).padStart(4)} ${f(r.FCP).padStart(5)} ${f(r.LCP).padStart(5)} ${f(r.CLS, 3).padStart(6)} ${f(r.TBT).padStart(4)} ${f(r.requests).padStart(4)} ${f(r.totalKB).padStart(5)}K ${f(r.jsKB).padStart(4)}K ${f(r.cssKB).padStart(3)}K ${f(r.dom).padStart(4)}`);
// budgets (Google "good" thresholds + repo-specific payload caps)
const bad = rows.filter((r) => r.LCP > 2500 || r.CLS > 0.1 || r.TBT > 200 || r.totalKB > 400);
console.log(bad.length ? `\nBUDGET EXCEEDED on: ${bad.map((b) => `${b.profile} ${b.path}`).join(", ")}` : "\nAll pages within budget: LCP <= 2.5 s, CLS <= 0.1, TBT <= 200 ms, transfer <= 400 KB");
process.exit(bad.length ? 1 : 0);
