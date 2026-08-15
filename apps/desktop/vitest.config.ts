import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@desktop": resolve(import.meta.dirname, "src") } },
  test: {
    coverage: { reporter: ["text", "json-summary"] },
    environment: "node",
  },
});
