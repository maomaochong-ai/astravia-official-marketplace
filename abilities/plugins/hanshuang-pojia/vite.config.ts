// @ts-nocheck — plugin-vite 内部 vite 通过 symlink 指向 open-astravia/.bun/，
// 与本包 node_modules/vite 是两个物理实例，rollup 私有属性的类型不兼容。
// 运行时构建正常，仅 IDE 红线。
import tailwindcss from "@tailwindcss/vite";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
			// 2. 340 篇工具包文档以纯文本随包发布，由 docs.ts 按需 fetch。
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

				// 3. 先例包的可执行工具以真实文件随包发布。脚本必须落盘才能被解释器执行，
				//    内联进 JS 分块等于把它变成不可执行的字符串。
				const casesRoot = new URL("cases/", import.meta.url);
				for (const entry of readdirSync(casesRoot, { withFileTypes: true })) {
					if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
					const toolsRoot = new URL(`${entry.name}/tools/`, casesRoot);
					if (!existsSync(toolsRoot)) continue;
					for (const file of walk(toolsRoot)) {
						this.emitFile({
							type: "asset",
							fileName: `assets/cases/${entry.name}/tools/${file}`,
							source: readFileSync(new URL(file, toolsRoot)),
						});
					}
				}

				// 4. 共享原语：每个工具都 import hpkit，缺它则一个都跑不起来。
				const kitRoot = new URL("cases/_shared/hpkit/", import.meta.url);
				for (const file of walk(kitRoot)) {
					this.emitFile({
						type: "asset",
						fileName: `assets/cases/_shared/hpkit/${file}`,
						source: readFileSync(new URL(file, kitRoot)),
					});
				}
			}
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
		if (entry.name === "__pycache__") continue;
		if (entry.isDirectory()) files.push(...walk(root, rel));
		else if (/\.(md|json|py)$/.test(entry.name)) files.push(relative(".", rel) || rel);
	}
	return files;
}
