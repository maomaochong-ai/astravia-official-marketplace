import tailwindcss from "@tailwindcss/vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    astraviaPluginFederation({ name: "shimo_reader", entry: "./src/index.tsx", hostThemeUi: true })
  ],
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  resolve: { dedupe: ["react", "react-dom"] }
});
