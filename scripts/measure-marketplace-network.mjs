#!/usr/bin/env node
/**
 * 量一次「刷新市场」和「安装一个能力」到底要搬多少字节、在这些字节上花多久。
 *
 * Desktop 的两条网络路径是固定的，本脚本照着它们各走一遍（见
 * docs/marketplace-network-cn.md 的取证小节）：
 *
 *   1. 刷新：`<repo>/archive/refs/heads/<ref>.zip` —— 整条 gh-pages 分支的归档。
 *      `open-marketplace-service.ts` 的 refresh() → sync() → downloadArchive() 无条件下载它，
 *      没有先问 manifest、没有 Range、没有条件请求。
 *   2. 安装：`releases[].artifact.url` —— GitHub Release 上的单个 .astraviapkg。
 *
 * 只做取样，不做全量下载：归档与制品都只读到 --sample-bytes 就断开，用字节数除以耗时得到
 * 这条链路当下的实际速率，再用它折算每个能力的预计等待时间。
 *
 * 用法：
 *   node scripts/measure-marketplace-network.mjs
 *   node scripts/measure-marketplace-network.mjs --limit 30 --sample-bytes 3145728
 *   node scripts/measure-marketplace-network.mjs --only dbx-pro,deckcraft
 *
 * 退出码：0 = 全部取样成功；1 = 有取样失败（失败项在表里标 n/a，不臆造数字）。
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 30_000;
const SAMPLE_BYTES = 2 * 1024 * 1024;

function option(name, fallback) {
	const index = process.argv.indexOf(`--${name}`);
	if (index === -1) return fallback;
	const value = process.argv[index + 1];
	return value && !value.startsWith("--") ? value : fallback;
}

const sampleBytes = Number(option("sample-bytes", SAMPLE_BYTES));
const limit = Number(option("limit", 30));
const only = option("only", "")
	.split(",")
	.map((slug) => slug.trim())
	.filter(Boolean);

function mib(bytes) {
	return bytes / 1024 / 1024;
}

function human(bytes) {
	if (bytes === null || bytes === undefined) return "n/a";
	if (bytes >= 1024 * 1024) return `${mib(bytes).toFixed(2)} MiB`;
	return `${(bytes / 1024).toFixed(0)} KiB`;
}

function duration(milliseconds) {
	if (!Number.isFinite(milliseconds)) return "n/a";
	if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
	if (milliseconds < 90_000) return `${(milliseconds / 1000).toFixed(1)} s`;
	return `${(milliseconds / 60_000).toFixed(1)} min`;
}

function eta(bytes, bytesPerSecond) {
	if (!bytes || !bytesPerSecond) return null;
	return (bytes / bytesPerSecond) * 1000;
}

async function fetchWithDeadline(url, init = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
	} finally {
		clearTimeout(timer);
	}
}

/** 慢链路、瞬时重置是常态：同一请求重试两次，仍失败才记 n/a，绝不编数字。 */
async function attempt(operation, attempts = 3) {
	let lastError;
	for (let index = 0; index < attempts; index += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 500 * (index + 1)));
		}
	}
	throw lastError;
}

/** 读满 limit 字节或读空，返回实际收到的字节数。用于在慢链路上取样而不是等完整个文件。 */
async function readSample(response, limit) {
	let received = 0;
	const reader = response.body?.getReader();
	if (!reader) {
		const buffer = Buffer.from(await response.arrayBuffer());
		return buffer.byteLength;
	}
	for (;;) {
		const chunk = await reader.read();
		if (chunk.done) break;
		received += chunk.value.byteLength;
		if (received >= limit) {
			await reader.cancel();
			break;
		}
	}
	return received;
}

/** 只取第 0 个字节，从 Content-Range 里读文件总长——这是唯一一处既准又便宜的体积来源。 */
async function probeSize(url) {
	const response = await fetchWithDeadline(url, { headers: { Range: "bytes=0-0" } });
	if (!response.ok && response.status !== 206) return null;
	const range = response.headers.get("content-range");
	await response.body?.cancel();
	const match = range?.match(/\/(\d+)$/);
	if (match) return Number(match[1]);
	const length = Number(response.headers.get("content-length"));
	return Number.isFinite(length) && length > 0 ? length : null;
}

async function measureTransfer(url, limit) {
	const startedAt = Date.now();
	const response = await fetchWithDeadline(url);
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const received = await readSample(response, limit);
	const elapsed = Math.max(Date.now() - startedAt, 1);
	return {
		received,
		elapsed,
		bytesPerSecond: (received / elapsed) * 1000,
		declaredSize: Number(response.headers.get("content-length")) || null,
	};
}

/** GitHub 的 contents API 带 raw accept 返回的就是文件本体，用它拿索引，避免 raw.githubusercontent 的超时。 */
function rawContentsUrl(repository, ref, path) {
	const [owner, name] = new URL(repository).pathname.split("/").filter(Boolean);
	return `https://api.github.com/repos/${owner}/${name}/contents/${path}?ref=${encodeURIComponent(ref)}`;
}

function archiveUrl(repository, ref) {
	return `${repository}/archive/refs/heads/${ref}.zip`;
}

async function loadIndex(repository, ref) {
	const response = await fetchWithDeadline(rawContentsUrl(repository, ref, ".astravia/marketplace.json"), {
		headers: { Accept: "application/vnd.github.raw", "User-Agent": "Astravia-Desktop" },
	});
	if (!response.ok) throw new Error(`Index HTTP ${response.status}`);
	const text = await response.text();
	const manifest = JSON.parse(text);
	return { manifest, bytes: Buffer.byteLength(text) };
}

function latestArtifacts(manifest) {
	const rows = [];
	for (const ability of manifest.abilities ?? []) {
		const release = (ability.releases ?? []).at(-1);
		const url = release?.artifact?.url;
		if (!url) continue;
		rows.push({ slug: ability.slug, type: ability.type, version: release.version, url });
	}
	return rows;
}

async function main() {
	const source = JSON.parse(await readFile(join(ROOT, ".astravia/marketplace.source.json"), "utf-8"));
	const repository = source.repository?.replace(/\/$/, "");
	const ref = "gh-pages";
	if (!repository) throw new Error("marketplace.source.json 缺少 repository");

	console.log(`仓库      ${repository}`);
	console.log(`分支      ${ref}`);
	console.log(`取样上限  ${human(sampleBytes)}/项\n`);

	const index = await loadIndex(repository, ref);
	console.log(`索引      ${human(index.bytes)}  ${index.manifest.abilities.length} 个条目  ${index.manifest.marketplaceVersion}`);

	const archive = archiveUrl(repository, ref);
	const archiveSample = await attempt(() => measureTransfer(archive, sampleBytes)).catch((error) => ({ error }));
	if (archiveSample.error) {
		console.log(`归档      ${archive}\n          取样失败：${archiveSample.error.message}`);
	} else {
		const total = archiveSample.declaredSize;
		const wait = eta(total, archiveSample.bytesPerSecond);
		console.log(
			`归档      ${total ? human(total) : "体积未知（chunked）"}  ${(archiveSample.bytesPerSecond / 1024).toFixed(0)} KiB/s` +
				`${wait ? `  ≈ ${duration(wait)} 每次刷新` : ""}`,
		);
	}

	const rows = latestArtifacts(index.manifest);
	const selected = only.length ? rows.filter((row) => only.includes(row.slug)) : rows;
	const head = selected.slice(0, limit);

	console.log(`\n制品      本轮成本取样 ${head.length}/${rows.length} 项（逐个只取第 0 字节问大小）\n`);
	const measured = [];
	for (const row of head) {
		const size = await attempt(() => probeSize(row.url)).catch(() => null);
		measured.push({ ...row, size });
	}

	const heaviest = [...measured].filter((row) => row.size).sort((a, b) => b.size - a.size).slice(0, 3);
	for (const row of heaviest) {
		const sample = await attempt(() => measureTransfer(row.url, sampleBytes)).catch(() => null);
		row.bytesPerSecond = sample?.bytesPerSecond ?? null;
	}

	console.log("能力                 版本        体积        本次取样速率     预计等待");
	console.log("─".repeat(84));
	for (const row of [...measured].sort((a, b) => (b.size ?? -1) - (a.size ?? -1))) {
		const wait = eta(row.size, row.bytesPerSecond);
		const speed = row.bytesPerSecond ? `${(row.bytesPerSecond / 1024).toFixed(0)} KiB/s` : "—";
		console.log(
			`${row.slug.padEnd(20)} ${String(row.version).padEnd(11)} ${human(row.size).padStart(10)}  ${speed.padStart(14)}  ${wait ? duration(wait).padStart(8) : "—".padStart(8)}`,
		);
	}

	const known = measured.filter((row) => row.size);
	const totalBytes = known.reduce((sum, row) => sum + row.size, 0);
	const overhead = archiveSample.declaredSize ?? 0;
	console.log("─".repeat(84));
	console.log(`已取样制品合计 ${human(totalBytes)}（${known.length} 项）；刷新归档 ${human(overhead) || "n/a"}`);
	console.log("注意：安装只下载被安装的那一个制品；合计值表示「全部装一遍」的成本，不是刷新成本。");

	const failures = measured.filter((row) => !row.size);
	if (failures.length) {
		console.log(`\n取样失败 ${failures.length} 项：${failures.map((row) => row.slug).join(", ")}`);
		process.exitCode = 1;
	}
}

await main();
