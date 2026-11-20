import { defineConfig } from "@playwright/test";
import {
  HTML_REPORT_DIR,
  QA_DB_PATH,
  TEST_RESULTS_DIR,
  getQaRoot,
} from "./tests/e2e/qaPaths";

// Ensure a single unique QA_ROOT is pinned for config, globalSetup, webServer, and workers.
getQaRoot();

const port = Number(process.env.PLAYWRIGHT_PORT || 3105);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PLAYWRIGHT_PORT: ${process.env.PLAYWRIGHT_PORT}`);
}

const explicitChannel =
  process.env.PLAYWRIGHT_CHANNEL?.trim() === "chrome" ? "chrome" : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: TEST_RESULTS_DIR,
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: HTML_REPORT_DIR, open: "never" }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...(explicitChannel ? { channel: explicitChannel } : {}),
    headless: true,
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npx next dev -p ${port} -H 127.0.0.1`,
    url: `http://127.0.0.1:${port}/cau-chuyen-go-noi`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "development",
      USE_LOCAL_SQLITE: "true",
      SQLITE_DB_PATH: QA_DB_PATH,
      AUTH_SECRET: "phase65-synthetic-qa-secret-32-chars",
      MEDIA_STORAGE_ENABLED: "false",
      ANALYTICS_ENABLED: "false",
    },
  },
});
