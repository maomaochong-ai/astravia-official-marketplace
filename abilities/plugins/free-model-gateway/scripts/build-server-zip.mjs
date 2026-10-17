// 将 server-src/（上游 our-free-model 运行时树）+ boot.mjs 打成确定性 zip，
// 供插件运行时经 astravia-plugin:// 协议拉取并交给宿主 PluginServiceRuntimeInstaller
// （sha256 校验 + 解压到 runtime/versions/<version>/server/）。
//
// 用法：bun scripts/build-server-zip.mjs
// 产物：public/ofm-server.zip（vite build 会把 public/ 拷进 dist/）
// 输出：zip 的 sha256，必须与 plugin.json providers.services[0].runtime.platforms.*.artifacts[0].sha256 一致；
//       脚本会用 --check 模式（CI/默认 build 内置）核对 plugin.json，不一致即失败。

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(pluginRoot, "server-src");
const bootFile = path.join(pluginRoot, "boot.mjs");
const outputDir = path.join(pluginRoot, "public");
const outputFile = path.join(outputDir, "ofm-server.zip");

// 固定时间戳保证确定性（1980-01-01 是 zip DOS 时间下限）。
const FIXED_DATE = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

async function collectFiles(dir, prefix = "") {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await collectFiles(full, rel)));
		else if (entry.isFile()) files.push({ rel, full });
	}
	return files;
}

async function main() {
	const files = await collectFiles(sourceDir);
	const bootStat = await stat(bootFile);
	files.push({ rel: "boot.mjs", full: bootFile });
	files.sort((a, b) => a.rel.localeCompare(b.rel));

	const zip = new AdmZip();
	for (const file of files) {
		const data = await readFile(file.full);
		zip.addFile(file.rel, data);
	}
	// adm-zip 的 addFile 不收时间参数（第三参是 comment），默认取 now()。
	// 这里统一回写固定时间戳保证 zip 字节级确定（sha256 可钉在 plugin.json）。
	// 不重写 entry.header.attr：adm-zip 默认 external_attr = 0x81A40000（= 0o100644 << 16），
	// 主动重写会触发 adm-zip 的 int32 setter 截断，让 mode 变 0 并破坏 sha256 稳定。
	for (const entry of zip.getEntries()) {
		entry.header.time = FIXED_DATE;
	}

	await mkdir(outputDir, { recursive: true });
	await writeFile(outputFile, zip.toBuffer());

	const buffer = await readFile(outputFile);
	const sha256 = createHash("sha256").update(buffer).digest("hex");
	const totalBytes = files.reduce((sum, file) => sum + buffer.length, 0);
	process.stdout.write(
		`${JSON.stringify({ file: outputFile, entries: files.length, zipBytes: buffer.length, sha256 }, null, 2)}\n`,
	);
	void totalBytes;
	void bootStat;

	if (process.argv.includes("--check")) {
		const manifest = JSON.parse(await readFile(path.join(pluginRoot, "plugin.json"), "utf8"));
		const service = manifest.providers?.services?.[0];
		const shas = new Set(
			Object.values(service?.runtime?.platforms ?? {}).flatMap((platform) =>
				(platform.artifacts ?? []).map((artifact) => artifact.sha256),
			),
		);
		if (shas.size !== 1 || !shas.has(sha256)) {
			process.stderr.write(
				`plugin.json artifact sha256 ${[...shas].join(",") || "(none)"} != built ${sha256}\n` +
					"请更新 plugin.json 中所有 platforms 的 artifacts[0].sha256 后重新构建。\n",
			);
			process.exitCode = 1;
		}
	}
}

main().catch((error) => {
	process.stderr.write(`${error?.stack ?? error}\n`);
	process.exitCode = 1;
});
