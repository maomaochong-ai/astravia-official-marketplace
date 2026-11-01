import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { servicePayloadPlugin } from "./scripts/service-payload-plugin.mjs";

export default defineConfig({
  base: "./",
  plugins: [
    servicePayloadPlugin(),
    tailwindcss(),
    astraviaPluginFederation({ name: "video-downloader", entry: "./src/index.tsx" }),
  ],
  build: { assetsInlineLimit: 0 },
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
});
