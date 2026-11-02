import tailwindcss from "@tailwindcss/vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    astraviaPluginFederation({
      name: "vectorcraft",
      entry: "./src/index.tsx",
    }),
  ],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
});
