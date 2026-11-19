import os from "node:os";
import path from "node:path";

export const QA_ROOT =
  process.env.QA_ROOT?.trim() || path.join(os.tmpdir(), "gonoifc-phase65-qa");

export const QA_DB_PATH = path.join(QA_ROOT, "qa.sqlite");

export const SCREENSHOT_DIR =
  process.env.QA_SCREENSHOT_DIR?.trim() || path.join(QA_ROOT, "screenshots");

export const TEST_RESULTS_DIR = path.join(QA_ROOT, "test-results");
