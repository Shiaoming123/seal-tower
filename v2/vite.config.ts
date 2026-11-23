import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build` → dist/ (static hosting).  `npm run build:offline` → dist-offline/index.html, one self-contained file.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: mode === "offline" ? [viteSingleFile()] : [],
  build: {
    outDir: mode === "offline" ? "dist-offline" : "dist",
    assetsInlineLimit: mode === "offline" ? 100_000_000 : 4096,
    chunkSizeWarningLimit: 4000,
  },
  test: { environment: "node" },
}));
