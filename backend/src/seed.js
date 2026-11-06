import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";

const para = (...s) => s.join("\n\n");

// Titles mirror the posts listed on tactyqal.com; bodies are original sample text.
const POSTS = [
  { title: "The elevator pitch for business entrepreneurs", date: "2024-05-01", tags: ["pitching", "startups"],
    excerpt: "Thirty seconds is all you get. Here is how to make them count.",
    content: para("## Why 30 seconds matters", "An elevator pitch is a short, clear answer to: what do you do, for whom, and why does it matter?",
      "## A simple formula", "Problem → Solution → Who it's for → Why now. Practise it out loud until it sounds like a conversation, not a script.") },
  { title: "How to build a tech startup team?", date: "2024-04-20", tags: ["team", "startups"],
    excerpt: "Great products come from complementary people. Look for these three roles first.",
    content: para("## Start with complementary skills", "Most early teams need a builder, a seller and a designer. One person can wear two hats; nobody should wear all three.",
      "## Test before you commit", "Work on a small project together for two weeks before agreeing on equity.") },
  { title: "11 reasons why startups fail at the idea stage", date: "2024-04-10", tags: ["ideas", "startups"],
    excerpt: "Most startups don't die from bad code. They die from untested assumptions.",
    content: para("## The common traps", "No real customer problem, a market that is too small, building before talking to users, and falling in love with the solution.",
      "## What to do instead", "Interview ten potential customers before writing a line of code.") },
  { title: "50 No-code startup app ideas", date: "2025-07-09", tags: ["no-code", "ideas"],
    excerpt: "You don't need to write code to launch. Fifty ideas you can prototype this weekend.",
    content: para("## Ideas you can ship fast", "Niche job boards, local deal directories, habit trackers, appointment booking for small shops, and community marketplaces.",
      "## Pick one and validate it", "Build a landing page first and measure sign-ups.") },
  { title: "30 Startup ideas to solve food waste problems", date: "2024-03-15", tags: ["ideas", "impact"],
    excerpt: "Food waste is a huge, solvable problem. Thirty angles to explore.",
    content: para("## Where the waste happens", "Farms, restaurants, grocery stores and homes each waste food for different reasons.",
      "## Opportunities", "Surplus-food marketplaces, smart expiry tracking, and ugly-produce subscriptions.") },
  { title: "50 Startup ideas for Gen-Z Entrepreneurs", date: "2024-03-05", tags: ["ideas", "gen-z"],
    excerpt: "Young founders have an edge: they understand their peers. Ideas to start from.",
    content: para("## Build what you know", "Study tools, creator tools, thrift marketplaces and mental-health communities all start with lived experience.",
      "## Start small", "Launch a one-feature version and talk to your first ten users.") },
];

export function seed(db) {
  const ins = db.prepare(
    `INSERT INTO posts (slug, title, excerpt, content, status, read_minutes, published_at) VALUES (?,?,?,?, 'published', ?, ?)`
  );
  for (const p of POSTS) {
    const slug = p.title.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
    const id = Number(ins.run(slug, p.title, p.excerpt, p.content, Math.max(3, Math.round(p.content.split(/\s+/).length / 200)), new Date(p.date).toISOString()).lastInsertRowid);
    for (const t of p.tags) {
      db.prepare("INSERT OR IGNORE INTO tags(name) VALUES (?)").run(t);
      const { id: tid } = db.prepare("SELECT id FROM tags WHERE name = ?").get(t);
      db.prepare("INSERT INTO post_tags VALUES (?,?)").run(id, tid);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDb();
  if (db.prepare("SELECT COUNT(*) c FROM posts").get().c === 0) { seed(db); console.log("Seeded", POSTS.length, "posts"); }
  else console.log("DB already has posts; skipping");
}
