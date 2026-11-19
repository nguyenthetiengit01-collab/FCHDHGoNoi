import { defineConfig } from "@playwright/test";
import path from "node:path";

const QA_ROOT = "D:\\Test1\\_tmp_phase65_qa";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: path.join(QA_ROOT, "test-results"),
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3105",
    channel: "chrome",
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
      SQLITE_DB_PATH: path.join(QA_ROOT, "qa.sqlite"),
      AUTH_SECRET: "phase65-local-qa-secret-32-chars-minimum",
      MEDIA_STORAGE_ENABLED: "false",
      ANALYTICS_ENABLED: "false",
    },
  },
});
