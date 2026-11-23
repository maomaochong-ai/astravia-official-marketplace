import tailwindcss from "@tailwindcss/vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [
        tailwindcss(),
        astraviaPluginFederation({
            name: "astravia_generative_ui",
            entry: "./src/index.tsx",
            hostUi: true,
        }),
    ],
    esbuild: { jsx: "automatic", jsxImportSource: "react" },
    // 宿主 UI 包在本仓库是 `.tooling/open-astravia` 的 junction，那份 checkout 自带一套
    // react/react-dom；去重保证插件自己的渲染图只用一份。
    resolve: { dedupe: ["react", "react-dom"] },
    test: {
        environment: "jsdom",
        // The sandbox stylesheet is imported as raw text; keep vitest from blanking it like an ordinary CSS import.
        css: { include: [/sandbox\/.*\.css/] },
    },
});
