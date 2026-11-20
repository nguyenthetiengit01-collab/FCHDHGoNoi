import { cleanupQaSqliteFiles } from "./qaPaths";

export default async function globalTeardown() {
  const result = cleanupQaSqliteFiles();
  if (result.locked.length > 0) {
    console.warn(
      `[QA globalTeardown] Cleanup partial — ${result.cleaned.length} file(s) removed; ${result.locked.length} file(s) still locked by webServer process (unique per-run QA_ROOT prevents reuse): ${JSON.stringify(result.locked)}`
    );
  } else {
    console.log(
      `[QA globalTeardown] Cleanup complete — removed ${result.cleaned.length} disposable SQLite file(s).`
    );
  }
}
