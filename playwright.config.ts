import { defineConfig } from "@playwright/test";
import { QA_DB_PATH, TEST_RESULTS_DIR } from "./tests/e2e/qaPaths";

const browserChannel =
  process.env.PLAYWRIGHT_CHANNEL?.trim() ||
  (process.platform === "win32" && !process.env.CI ? "chrome" : undefined);

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
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3105",
    ...(browserChannel ? { channel: browserChannel } : {}),
    headless: true,
    serviceWorkers: "block",
    video: "off",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx next dev -p 3105 -H 127.0.0.1",
    url: "http://127.0.0.1:3105/cau-chuyen-go-noi",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: "development",
      USE_LOCAL_SQLITE: "true",
      SQLITE_DB_PATH: QA_DB_PATH,
      AUTH_SECRET: "phase65-local-qa-secret-32-chars-minimum",
      MEDIA_STORAGE_ENABLED: "false",
      ANALYTICS_ENABLED: "false",
    },
  },
});
