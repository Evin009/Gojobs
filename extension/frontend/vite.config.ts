import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// One bundle, injected into the page as a content script. The UI can't live in
// a toolbar popup: a popup is a separate document, so it could never morph into
// the notch. Same document, same element, real morph.
//
// IIFE because MV3 content scripts aren't modules.
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: resolve(__dirname, "../dist"),
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, "src/content/mount.tsx"),
      name: "GojobsUI",
      formats: ["iife"],
      fileName: () => "ui.js",
    },
  },
});
