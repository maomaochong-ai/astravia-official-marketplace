import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "xiaohongshu-runtime-resources",
      generateBundle() {
        for (const source of [
          "detail.json",
          "detail.zh.json",
          "LICENSE",
          "upstream.json",
        ]) {
          this.emitFile({
            type: "asset",
            fileName: `assets/${source}`,
            source: readFileSync(new URL(source, import.meta.url)),
          });
        }
      },
    },
    tailwindcss(),
    astraviaPluginFederation({ name: "xiaohongshu", entry: "./src/index.tsx" }),
  ],
  build: { assetsInlineLimit: 0 },
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
});
