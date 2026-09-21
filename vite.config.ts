import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// ADR-0002 — the release artifact is one self-contained index.html.
// Ticket 21 adds the check that the output really is single-file.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    target: "es2022",
    assetsInlineLimit: Number.POSITIVE_INFINITY,
    cssCodeSplit: false,
  },
});
