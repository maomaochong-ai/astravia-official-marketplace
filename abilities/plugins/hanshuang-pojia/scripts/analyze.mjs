#!/usr/bin/env node
/**
 * `scripts/analyze.mjs` —— 把 `src/cli/analyze.ts` 打成 node 包再执行。
 *
 * 为什么不直接用 tsx / vite-node：那份装法依赖开发机上的 loader 与架构匹配的
 * rollup 二进制；而这个脚本要能在任何有 node 的机器上跑（CI、别人的笔记本），
 * esbuild 是 devDependency 里已有的唯一硬依赖，打包一次胜过一辈子的 loader 配置。
 *
 * 为什么要独立于插件：插件的 fs 授权只在宿主进程里有效，命令行要读任意路径，
 * 所以文件读取留在这一层，领域引擎在打包产物里 —— 两侧跑的是同一份源码。
 */
import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const outfile = join(root, ".cache", "analyze.mjs");

async function bundle() {
	await mkdir(dirname(outfile), { recursive: true });
	await build({
		entryPoints: [join(root, "src/cli/analyze.ts")],
		outfile,
		bundle: true,
		platform: "node",
		format: "esm",
		target: "node18",
		logLevel: "warning",
		// 插件 SDK 只被 `import type` 引用，理论上不会进包；留一行 external 是为了
		// 万一将来某个领域文件误引了运行时，打包直接报错而不是把宿主依赖塞进来。
		external: ["@astravia-org/plugin-sdk"],
	});
}

await bundle();
const { runCli } = await import(pathToFileURL(outfile).href);
const code = await runCli(process.argv.slice(2), {
	write: text => {
		process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
	},
	writeError: text => {
		process.stderr.write(text.endsWith("\n") ? text : `${text}\n`);
	},
});
// 打包产物是临时文件：CI 里跑完就丢，本地也不该被提交。
if (process.env.ANALYZE_KEEP_BUNDLE !== "1") await rm(outfile, { force: true });
process.exit(code);
