// @ts-nocheck — plugin-vite 内部 vite 通过 symlink 指向 open-astravia/.bun/，
// 与本包 node_modules/vite 是两个物理实例，rollup 私有属性的类型不兼容。
// 运行时构建正常，仅 IDE 红线。
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, readdirSync } from "node:fs";
import { relative } from "node:path";
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
			// 两件事都发生在插件运行期，安装后不依赖市场源：
			// 1. 能力详情页读取的两份正文；
			// 2. 309 篇工具包文档以纯文本随包发布，由 docs.ts 按需 fetch。
			//    放进 JS 分块会把整片攻击工具链语料编译成可执行脚本，既拖慢安装，
			//    也让系统杀毒把插件包当成工具集样本。
			name: "hanshuang-pojia-runtime-resources",
			generateBundle() {
				for (const source of ["detail.json", "detail.zh.json"]) {
					this.emitFile({
						type: "asset",
						fileName: `assets/${source}`,
						source: readFileSync(new URL(source, import.meta.url)),
					});
				}
				const root = new URL("src/content/docs/", import.meta.url);
				for (const file of walk(root)) {
					this.emitFile({
						type: "asset",
						fileName: `assets/docs/${file}`,
						source: readFileSync(new URL(file, root)),
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

/** 只收文档与附件，跳过索引之外的杂项。 */
function walk(root: URL, prefix = ""): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(new URL(prefix || ".", root), { withFileTypes: true })) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) files.push(...walk(root, rel));
		else if (/\.(md|json)$/.test(entry.name)) files.push(relative(".", rel) || rel);
	}
	return files;
}
