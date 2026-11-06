import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { seed } from "./seed.js";

const db = openDb();
if (db.prepare("SELECT COUNT(*) c FROM posts").get().c === 0) seed(db);
const port = process.env.PORT || 4000;
createApp(db).listen(port, () => console.log(`Blog API on http://localhost:${port}/api`));
