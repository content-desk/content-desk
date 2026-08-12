import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()] },
  preload: {
    build: {
      rollupOptions: { output: { entryFileNames: "index.cjs", format: "cjs" } },
    },
    plugins: [externalizeDepsPlugin({ exclude: ["zod"] })],
  },
  renderer: { plugins: [react()] },
});
