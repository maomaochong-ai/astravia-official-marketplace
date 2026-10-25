import { readFileSync } from "node:fs";

import tailwindcss from "@tailwindcss/vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { defineConfig } from "vite";

/**
 * 运行时可读不到包内 plugin.json，所以把平台键集在构建期注入。
 *
 * 同一次 `npm run build` 里 scripts/check-service-platforms.mjs 已经保证
 * plugin.json 的键与 server/boot.mjs 的 PAYLOADS 一致，因此注入值不会被写歪。
 */
const manifest = JSON.parse(readFileSync(new URL("./plugin.json", import.meta.url), "utf8")) as {
  providers?: { services?: { runtime?: { platforms?: Record<string, unknown> } }[] };
};
const supportedPlatforms = Object.keys(
  manifest.providers?.services?.[0]?.runtime?.platforms ?? {},
);

export default defineConfig({
  define: {
    __SUPPORTED_PLATFORMS__: JSON.stringify(supportedPlatforms),
  },
  plugins: [
    tailwindcss(),
    astraviaPluginFederation({
      name: "openAiCanvas",
      entry: "./src/index.tsx",
    }),
  ],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
});
