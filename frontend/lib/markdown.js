// Tiny, safe markdown subset (##, ###, -, paragraphs, **bold**). Output is escaped first.
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

export function renderMarkdown(src = "") {
  return src
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim();
      if (b.startsWith("### ")) return `<h3>${inline(b.slice(4))}</h3>`;
      if (b.startsWith("## ")) return `<h2>${inline(b.slice(3))}</h2>`;
      if (/^[-*] /.test(b)) return `<ul>${b.split("\n").map((l) => `<li>${inline(l.replace(/^[-*] /, ""))}</li>`).join("")}</ul>`;
      return b ? `<p>${inline(b).replace(/\n/g, "<br/>")}</p>` : "";
    })
    .join("");
}
