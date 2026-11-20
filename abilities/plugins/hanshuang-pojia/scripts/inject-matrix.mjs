#!/usr/bin/env node
/**
 * 九目标注入矩阵的离线入口：一次生成全部目标的安装脚本与卸载脚本。
 *
 * 为什么放在 `scripts/` 而生成逻辑仍在 `src/domain/inject/`：
 * `scripts/` **不随包发布**（`stage-plugin-release.py` 的 RUNTIME_DIRS 只有
 * dist / locales / agent / assets / service / web）。面板要在运行时生成脚本，
 * 所以生成器必须留在 src；而“给九个目标批量产出脚本”是一次性运维动作，
 * 属于这台开发机，写在这里才能被 npm script 与 CI 调用。
 * 两者共用同一份实现（经 esbuild 打包引入），不存在第二套模板。
 *
 * 用法：
 *   node scripts/inject-matrix.mjs                      # 九个目标 → .hanshuang/inject/
 *   node scripts/inject-matrix.mjs --out <dir>          # 指定输出目录
 *   node scripts/inject-matrix.mjs --shell posix        # 只要 sh 版
 *   node scripts/inject-matrix.mjs --target codex       # 只要一个目标
 *   node scripts/inject-matrix.mjs --kind remove        # 只出卸载脚本
 *   node scripts/inject-matrix.mjs --list               # 只看矩阵，不写文件
 */
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bundlePath = join(root, ".cache", "inject-matrix.mjs");

await mkdir(dirname(bundlePath), { recursive: true });
await build({
	entryPoints: [join(root, "src/domain/inject/matrix.ts")],
	bundle: true,
	format: "esm",
	platform: "node",
	outfile: bundlePath,
	logLevel: "silent",
});
const { buildMatrix } = await import(pathToFileURL(bundlePath).href);

function flag(name, fallback = null) {
	const at = process.argv.indexOf(`--${name}`);
	return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
}

const outDir = resolve(root, flag("out", ".hanshuang/inject"));
const shell = flag("shell", "all");
const target = flag("target", null);
const kind = flag("kind", "both");
const body = readFileSync(join(root, "src/content/packs/execution-kernel.md"), "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");

const files = buildMatrix({ body, packLabel: "execution-kernel", shell, target, kind });

if (process.argv.includes("--list")) {
	for (const file of files) console.log(`${file.target}\t${file.kind}\t${file.shell}\t${file.name}`);
	console.log(`\n${files.length} file(s)`);
	process.exit(0);
}

await mkdir(outDir, { recursive: true });
const written = [];
for (const file of files) {
	const targetPath = join(outDir, file.name);
	await writeFile(targetPath, file.content, "utf8");
	written.push(targetPath);
}
console.log(`wrote ${written.length} file(s) to ${outDir}`);
if (!existsSync(outDir)) console.error("output directory missing after write — check permissions");
