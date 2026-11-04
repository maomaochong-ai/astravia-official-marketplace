import tailwindcss from "@tailwindcss/vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { defineConfig } from "vite";
import { APP } from "./src/app.config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    astraviaPluginFederation({
      name: APP.id,
      entry: "./src/index.tsx",
    }),
  ],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
});
