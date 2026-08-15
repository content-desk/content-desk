import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const alias = { "@desktop": resolve(import.meta.dirname, "src") };

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], resolve: { alias } },
  preload: {
    build: {
      rollupOptions: { output: { entryFileNames: "index.cjs", format: "cjs" } },
    },
    plugins: [externalizeDepsPlugin({ exclude: ["zod"] })],
    resolve: { alias },
  },
  renderer: { plugins: [react()], resolve: { alias } },
});
