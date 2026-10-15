// @ts-nocheck — plugin-vite 内部 vite 与本包 node_modules/vite 是两个物理实例（开发模式用
// tooling 目录的 vite，npm install 走本地的）。rollup hook 类型两边不一致，仅 IDE 红线。
import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
      },
    },
  },
  plugins: [
    {
      name: "rea-runtime-resources",
      generateBundle() {
        for (const source of ["detail.json", "detail.zh.json"]) {
          this.emitFile({
            type: "asset",
            fileName: `assets/${source}`,
            source: readFileSync(new URL(source, import.meta.url)),
          });
        }
      },
    },
    tailwindcss(),
    astraviaPluginFederation({
      name: "rea",
      entry: "./src/index.tsx",
    }),
  ],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
});
