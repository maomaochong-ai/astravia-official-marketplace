// @ts-nocheck — plugin-vite 内部 vite 通过 symlink 指向 open-astravia/.bun/，
// 与本包 node_modules/vite 是两个物理实例，rollup 私有属性的类型不兼容。
// 运行时构建正常，仅 IDE 红线。
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";

export default defineConfig({
	base: "./",
	build: {
		rollupOptions: {
			output: {
				assetFileNames: "assets/[name]-[hash][extname]",
				entryFileNames: "assets/[name]-[hash].js",
				chunkFileNames: "assets/[name]-[hash].js",
			},
		},
	},
	plugins: [
		{
			// 能力详情页在插件运行期从 dist/assets 读取这两份正文；随构建产物一起发出去，
			// 安装后的详情不依赖市场源。
			name: "hanshuang-pojia-runtime-resources",
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
			name: "hanshuang_pojia",
			entry: "./src/index.tsx",
		}),
	],
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
});
