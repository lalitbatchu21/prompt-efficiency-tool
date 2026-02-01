import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/background/index.ts"),
      name: "PromptEfficiencyBackground",
      formats: ["iife"],
      fileName: () => "assets/background.js"
    },
    rollupOptions: {
      treeshake: "recommended"
    }
  }
});
