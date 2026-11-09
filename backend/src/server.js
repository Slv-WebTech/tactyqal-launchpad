import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { loadConfig, describeMode } from "./config.js";
import { seed } from "./seed.js";

const config = loadConfig(); // throws on a weak ADMIN_KEY or ALLOW_OPEN_WRITES in production
const db = openDb();
if (db.prepare("SELECT COUNT(*) c FROM posts").get().c === 0) seed(db);

const port = process.env.PORT || 4000;
const server = createApp(db, config).listen(port, () =>
  console.log(`Blog API on http://localhost:${port}/api (${describeMode(config)})`)
);
// stay above typical load-balancer idle timeouts (60s) to avoid intermittent 502s
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// graceful shutdown: stop accepting, let in-flight requests finish, close the DB
let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("unhandledRejection", (e) => console.error("unhandledRejection", e));
