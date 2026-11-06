import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../lib/markdown.js";

test("renders headings, paragraphs, bold and lists", () => {
  const html = renderMarkdown("## Title\n\nHello **world**\n\n### Sub\n\n- a\n- b");
  assert.equal(html, "<h2>Title</h2><p>Hello <strong>world</strong></p><h3>Sub</h3><ul><li>a</li><li>b</li></ul>");
});

test("escapes HTML and script injection in every position", () => {
  const evil = '<script>alert(1)</script><img src=x onerror=alert(1)>';
  for (const src of [evil, `## ${evil}`, `- ${evil}`, `**${evil}**`, `### ${evil}`]) {
    const html = renderMarkdown(src);
    assert.ok(!/<script|<img/i.test(html), html);
    assert.ok(html.includes("&lt;"), html);
  }
});

test("escapes quotes and ampersands safely, no double-escaping of output", () => {
  assert.equal(renderMarkdown("a & b"), "<p>a &amp; b</p>");
  assert.ok(!renderMarkdown('"><svg onload=1>').includes("<svg"));
});

test("edge inputs: empty, undefined, whitespace-only, only newlines", () => {
  assert.equal(renderMarkdown(""), "");
  assert.equal(renderMarkdown(), "");
  assert.equal(renderMarkdown("   \n\n  \n"), "");
});

test("single newlines inside a paragraph become <br/>; unmatched ** stays literal", () => {
  assert.equal(renderMarkdown("line1\nline2"), "<p>line1<br/>line2</p>");
  assert.equal(renderMarkdown("2 ** 3"), "<p>2 ** 3</p>");
});

test("javascript: links are not turned into anchors (no link syntax supported)", () => {
  const html = renderMarkdown("[x](javascript:alert(1))");
  assert.ok(!html.includes("<a"));
});

test("very large input renders quickly (no catastrophic regex backtracking)", () => {
  const t = Date.now();
  renderMarkdown("**a".repeat(50000) + "\n\n" + "- x\n".repeat(20000));
  assert.ok(Date.now() - t < 1500, `took ${Date.now() - t}ms`);
});
