import { cleanupQaSqliteFiles } from "./qaPaths";

export default async function globalTeardown() {
  const result = cleanupQaSqliteFiles();
  if (result.locked.length > 0) {
    console.log(
      `[QA globalTeardown] Cleanup partial — ${result.cleaned.length} file(s) removed; ${result.locked.length} file(s) remain open in webServer until Playwright terminates it (unique per-run QA_ROOT prevents reuse).`
    );
  } else {
    console.log(
      `[QA globalTeardown] Cleanup complete — removed ${result.cleaned.length} disposable SQLite file(s).`
    );
  }
}
