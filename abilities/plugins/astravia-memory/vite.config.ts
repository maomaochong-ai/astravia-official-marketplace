import tailwindcss from "@tailwindcss/vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        tailwindcss(),
        astraviaPluginFederation({
            name: "astravia_memory",
            entry: "./src/index.tsx",
            // Host design-system primitives (@astravia-org/ui) come from the app singleton.
            hostUi: true,
        }),
    ],
    esbuild: { jsx: "automatic", jsxImportSource: "react" },
    test: { environment: "jsdom" },
});
