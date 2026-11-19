import fs from "node:fs";
import { QA_DB_PATH } from "./qaPaths";

export default async function globalTeardown() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const target = `${QA_DB_PATH}${suffix}`;
    if (fs.existsSync(target)) {
      try {
        fs.rmSync(target, { force: true });
      } catch {
        // On Windows, Playwright's webServer may still hold an open SQLite handle until process exit;
        // globalSetup cleans stale qa.sqlite* files before the next run.
      }
    }
  }
}
