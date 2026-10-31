import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { isDisposableTestDatabase } from "../lib/db/testDatabaseSafety";
const cwd = fileURLToPath(new URL("..", import.meta.url));
const production = process.env.SITEOPS_TOOLS_PRODUCTION === "1";
const database = process.env.SITEOPS_SCRATCH_DB_URL;
if (!database)
  throw new Error(
    "Set SITEOPS_SCRATCH_DB_URL to the disposable loopback tools database.",
  );
if (!isDisposableTestDatabase(database))
  throw new Error(
    "Tools browser tests only allow the disposable local siteops_tools_test database.",
  );
export default defineConfig({
  testDir: ".",
  testMatch: production ? "tools-pwa.spec.ts" : "tools-inventory.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  outputDir: "/tmp/siteops-tools-browser-results",
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3107", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      cwd,
      command: "node e2e/fixtures/tools-auth-server.mjs",
      url: "http://127.0.0.1:55440/health",
      reuseExistingServer: false,
    },
    {
      cwd,
      command: production
        ? "npx next start -H 127.0.0.1 -p 3107"
        : "npx next dev --webpack -H 127.0.0.1 -p 3107",
      url: "http://127.0.0.1:3107/auth/sign-in",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        DATABASE_URL: database,
        DIRECT_URL: database,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55440",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-test-only",
        SITEOPS_TOOLS_E2E: "1",
        UPSTASH_REDIS_REST_URL: "http://127.0.0.1:55441",
        UPSTASH_REDIS_REST_TOKEN: "local-test-only",
      },
    },
  ],
});
