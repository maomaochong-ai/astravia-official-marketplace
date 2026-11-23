import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
  // The remote is served from this plugin's own dist directory, so relative asset
  // URLs stay on that plugin origin instead of the host /assets root.
  base: "./",
  plugins: [
    tailwindcss(),
    astraviaPluginFederation({
      name: "web_access",
      entry: "./src/index.tsx",
      // Host design-system primitives (@astravia-org/ui) and the settings chrome the app
      // exposes to plugins (@astravia-org/theme-ui/plugin-ui) come from the app singleton.
      hostUi: true,
      hostThemeUi: true
    })
  ],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react"
  },
  resolve: { dedupe: ["react", "react-dom"] },
  server: {
    fs: {
      // 宿主设计系统来自仓库根的 `.tooling/open-astravia`，在工程目录之外；
      // 不放开这个目录，测试里 import 的图标文件会被 dev server 拒绝。
      allow: [fileURLToPath(new URL("../../../..", import.meta.url))]
    }
  },
  test: {
    // 宿主组件里的 `?url` 图标资源在工具链目录下，交给 vite 处理而不是外部化。
    server: { deps: { inline: [/@astravia-org\/(theme-ui|ui)/] } }
  }
});
