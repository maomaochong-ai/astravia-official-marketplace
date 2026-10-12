import tailwindcss from "@tailwindcss/vite";
import { readFileSync, renameSync, existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { defineConfig } from "vite";
import { astraviaPluginFederation } from "@astravia-org/plugin-vite";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** ESM 下没有 __dirname，用 import.meta.url 推导。 */
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * tailwind4-vite-plugin 把 CSS 输出到 dist/style.css（根目录、无 content-hash）。
 * 宿主强缓存 style.css 文件名不变 → 每次发布后重载都加载旧 CSS（新 JS + 旧 Tailwind utilities 冲突 = 布局乱）。
 * 这个 plugin 在 closeBundle 阶段（rollup LIFO — 在 astraviaPluginFederation **之后** close，确保 federation 拿到改好的文件）：
 *   1. 读 dist/style.css → 算 hash → 改名 style-[hash].css 移到 dist/assets/
 *   2. 更新 dist/remoteEntry.js 里唯一的 "./style.css" 引用
 *   3. 更新 dist/mf-manifest.json 里的 css.sync 数组
 *   4. 更新 plugin.json 的 styles 数组（federation plugin 从这里读路径打包进 .astraviapkg）
 * 这样 CSS 文件名每次构建都变（content-based），宿主必须拉新文件，缓存彻底失效。
 */
function cssHashPlugin() {
	return {
		name: "dbx-css-hash",
		closeBundle: {
			order: "post" as const,
			async handler() {
				const distDir = join(__dirname, "dist");
				const stylePath = join(distDir, "style.css");
				if (!existsSync(stylePath)) return;

				const css = readFileSync(stylePath);
				const hash = createHash("sha256").update(css).digest("hex").slice(0, 10);
				const newName = `style-${hash}.css`;
				const assetsDir = join(distDir, "assets");
				mkdirSync(assetsDir, { recursive: true });
				const newPath = join(assetsDir, newName);
				renameSync(stylePath, newPath);

				// 1. 更新 remoteEntry.js（只有一处引用 "./style.css"）
				const rePath = join(distDir, "remoteEntry.js");
				if (existsSync(rePath)) {
					let re = readFileSync(rePath, "utf8");
					re = re.replace(/["']\.\/style\.css["']/g, `"./assets/${newName}"`);
					writeFileSync(rePath, re);
				}

				// 2. 更新 mf-manifest.json
				const mfPath = join(distDir, "mf-manifest.json");
				if (existsSync(mfPath)) {
					const mf = JSON.parse(readFileSync(mfPath, "utf8"));
					if (mf.exposes?.[0]?.assets?.css?.sync) {
						mf.exposes[0].assets.css.sync = [`assets/${newName}`];
						writeFileSync(mfPath, `${JSON.stringify(mf, null, 2)}\n`);
					}
				}

				// 3. 更新 plugin.json 的 styles 数组（federation plugin close 时会读这里）
				const pluginJsonPath = join(__dirname, "plugin.json");
				if (existsSync(pluginJsonPath)) {
					const pj = JSON.parse(readFileSync(pluginJsonPath, "utf8"));
					if (pj.styles && Array.isArray(pj.styles)) {
						pj.styles = [`dist/assets/${newName}`];
						writeFileSync(pluginJsonPath, `${JSON.stringify(pj, null, 2)}\n`);
					}
				}

				console.log(`  [css-hash] style.css → assets/${newName} (sha256: ${hash})`);
			},
		},
	};
}

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
			name: "dbx-runtime-resources",
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
		// cssHashPlugin 必须在 astraviaPluginFederation 之后注册 — rollup closeBundle 是 LIFO（后注册先执行），
		// 这样 federation close 时 css 文件名已改好，.astraviapkg 里就是带 hash 的 CSS。
		astraviaPluginFederation({
			name: "dbx_pro",
			entry: "./src/index.tsx",
		}),
		cssHashPlugin(),
	],
	esbuild: {
		jsx: "automatic",
		jsxImportSource: "react",
	},
});
