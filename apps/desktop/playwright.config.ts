import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: "list",
  testDir: "tests/e2e",
  timeout: 30_000,
  workers: 1,
});
