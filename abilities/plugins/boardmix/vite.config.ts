// @ts-nocheck — 与其余插件相同的实例分裂问题：plugin-vite 内部的 vite 与本包
// node_modules/vite 是两个物理实例，rollup 私有类型不兼容，只影响 IDE 红线。
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";

export default defineConfig({
	base: "./",
	plugins: [
		tailwindcss(),
		astraviaPluginFederation({
			name: "boardmix",
			entry: "./src/index.tsx",
		}),
	],
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
});
