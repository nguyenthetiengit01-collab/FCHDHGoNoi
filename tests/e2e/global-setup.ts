import fs from "node:fs";
import path from "node:path";
import { QA_DB_PATH, QA_ROOT, SCREENSHOT_DIR } from "./qaPaths";

export default async function globalSetup() {
  fs.mkdirSync(QA_ROOT, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const target = `${QA_DB_PATH}${suffix}`;
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
    }
  }

  const seedSource = path.resolve(process.cwd(), "data", "gonoifc.sqlite");
  if (!fs.existsSync(seedSource)) {
    throw new Error(`Missing seed SQLite fixture at ${seedSource}`);
  }
  if (path.resolve(QA_DB_PATH) === seedSource) {
    throw new Error("QA_DB_PATH must not point to data/gonoifc.sqlite");
  }

  fs.copyFileSync(seedSource, QA_DB_PATH);

  // Trigger initDb() schema migrations on the disposable QA copy before tests visit SSR routes.
  const res = await fetch("http://127.0.0.1:3105/api/team");
  if (!res.ok) {
    throw new Error(`Failed to initialize QA SQLite fixture via /api/team: HTTP ${res.status}`);
  }
}
