// @ts-nocheck — plugin-vite 内部 vite 通过 symlink 指向 open-astravia/.bun/，与本包 node_modules/vite 是两个物理实例。
// rollup 的私有属性类型不兼容导致 vite.config.ts 的 PluginOption 签名冲突；运行时构建完全正常，仅 IDE 红线。
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";

export default defineConfig({
	base: "./",
	plugins: [
		{
			name: "as-ocr-runtime-resources",
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
			name: "as_ocr",
			entry: "./src/index.tsx",
		}),
	],
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
});
