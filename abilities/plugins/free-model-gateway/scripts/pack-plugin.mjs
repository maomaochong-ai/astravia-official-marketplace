// 打包插件安装包 release/<id>-<version>.astraviapkg（=zip）。
//
// 为什么需要脚本而不是手工压缩：安装包必须自包含——dist/ofm-server.zip（宿主托管服务的
// 运行时物料，约 4.6MB）必须进包，并与其在 plugin.json providers.services[].runtime 里
// 声明的 sha256 一致。手工压缩容易漏掉这个大文件（0.2.0 首次打包就漏了，导致
// 「服务运行时安装失败」），因此这里做三重校验：文件存在、sha256 匹配 manifest、条目含 zip。
//
// 用法：bun scripts/pack-plugin.mjs
// 前置：bun run build（先出 public/ofm-server.zip，再由 vite 拷进 dist/）

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(pluginRoot, "dist");
const localesDir = path.join(pluginRoot, "locales");
const releaseDir = path.join(pluginRoot, "release");
const serverZip = path.join(distDir, "ofm-server.zip");

const FIXED_DATE = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));
// vite 构建统计与 source map 不进安装包。
const EXCLUDED = new Set(["mf-stats.json"]);

async function collectFiles(dir, prefix = "") {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (EXCLUDED.has(entry.name)) continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await collectFiles(full, rel)));
		else if (entry.isFile()) files.push({ rel, full });
	}
	return files;
}

async function main() {
	const manifest = JSON.parse(await readFile(path.join(pluginRoot, "plugin.json"), "utf8"));
	const version = JSON.parse(await readFile(path.join(pluginRoot, "package.json"), "utf8")).version;
	if (manifest.version !== version) {
		throw new Error(`version mismatch: plugin.json ${manifest.version} != package.json ${version}`);
	}

	const entries = [];
	for (const name of ["plugin.json", "ability.json", "icon.png"]) {
		const full = path.join(pluginRoot, name);
		try {
			await stat(full);
			entries.push({ rel: name, full });
		} catch {
			if (name !== "ability.json") throw new Error(`missing plugin file: ${name}`);
		}
	}
	entries.push(...(await collectFiles(distDir, "dist")));
	entries.push(...(await collectFiles(localesDir, "locales")));
	entries.sort((a, b) => a.rel.localeCompare(b.rel));

	// 校验 1：运行时物料必须存在。
	await stat(serverZip).catch(() => {
		throw new Error(`missing ${serverZip}; run \`bun run build\` first`);
	});
	const serverBytes = await readFile(serverZip);
	const serverSha = createHash("sha256").update(serverBytes).digest("hex");
	// 校验 2：与 manifest 声明一致（所有平台共用同一 zip）。
	const declared = new Set(
		Object.values(manifest.providers?.services?.[0]?.runtime?.platforms ?? {}).flatMap((platform) =>
			(platform.artifacts ?? []).map((artifact) => artifact.sha256),
		),
	);
	if (declared.size !== 1 || !declared.has(serverSha)) {
		throw new Error(
			`ofm-server.zip sha256 ${serverSha} != plugin.json ${[...declared].join(",") || "(none)"}`,
		);
	}

	const zip = new AdmZip();
	for (const entry of entries) {
		zip.addFile(entry.rel, await readFile(entry.full));
	}
	for (const entry of zip.getEntries()) {
		entry.header.time = FIXED_DATE;
	}

	await mkdir(releaseDir, { recursive: true });
	const outputFile = path.join(releaseDir, `${manifest.id}-${version}.astraviapkg`);
	const buffer = zip.toBuffer();
	await writeFile(outputFile, buffer);

	// 校验 3：成品包里必须能查到服务 zip 条目。
	const packaged = new AdmZip(buffer).getEntries().map((entry) => entry.entryName);
	const packagedServer = packaged.find((name) => name.endsWith("ofm-server.zip"));
	if (!packagedServer) {
		throw new Error(`packaged plugin is missing the server archive (${packaged.length} entries)`);
	}

	process.stdout.write(
		`${JSON.stringify(
			{
				file: outputFile,
				entries: packaged.length,
				bytes: buffer.length,
				serverArchive: { entry: packagedServer, bytes: serverBytes.length, sha256: serverSha },
			},
			null,
			2,
		)}\n`,
	);
}

main().catch((error) => {
	process.stderr.write(`${error?.stack ?? error}\n`);
	process.exitCode = 1;
});
