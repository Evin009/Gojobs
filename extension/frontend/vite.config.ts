import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Builds the popup into ../dist, which the manifest points at. Chrome loads
// extension/ — the content scripts sit there as plain files, since they run in
// the page and need no bundling.
export default defineConfig({
  plugins: [react()],
  // relative asset paths: the page is served from dist/, so a leading "/"
  // would resolve to the extension root and load nothing
  base: "./",
  build: {
    outDir: resolve(__dirname, "../dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: { popup: resolve(__dirname, "index.html") },
      output: {
        // stable names: the manifest references these paths directly
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});
