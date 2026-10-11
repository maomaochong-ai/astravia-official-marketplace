/**
 * driver.mjs — 驱动管理路由（request-router 元组风格，与 connections/query 等一致）。
 *
 * 路由（无 /api 前缀，由 request-router 统一聚合）：
 *   POST /driver/status   列出所有托管驱动的安装状态
 *   POST /driver/install   下载安装指定驱动
 *   POST /driver/set-path  手动指定驱动路径（复制到标准驱动目录）
 *
 * DuckDB 驱动背景：
 *   dbx-mcp 执行 API 数据源查询时需要 `duckdb_worker`——这其实是
 *   dbx Desktop 从 agents-release CI 产出的 `dbx-duckdb-driver`
 *   Rust binary（crates/dbx-drivers/src/db/duckdb_worker_process.rs 第 685-694 行
 *   通过 DBX_DUCKDB_DRIVER_PATH 环境变量查找）。产物命名：
 *     dbx-agent-duckdb-macos-aarch64
 *     dbx-agent-duckdb-macos-x64
 *     ...
 *   下载 URL：github.com/t8y2/dbx/releases/download/agents-latest/<name>
 *
 *   本地驱动存储目录：~/.astravia-dbx-data/drivers/<key>/<platform>/<binary>
 *   与 dbx-mcp-client.collectDriverEnv() 扫描路径一致。
 */

import {
	existsSync,
	mkdirSync,
	chmodSync,
	statSync,
	createWriteStream,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DRIVERS_ROOT = join(homedir(), ".astravia-dbx-data", "drivers");
const DBX_AGENTS_LATEST = "https://github.com/t8y2/dbx/releases/download/agents-latest";

// ─── 平台映射 ───

function platformKey() {
	const { platform, arch } = process;
	if (platform === "darwin") return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
	if (platform === "win32") return arch === "arm64" ? "win32-arm64" : "win32-x64";
	if (platform === "linux") return arch === "arm64" ? "linux-arm64" : "linux-x64";
	return "unknown";
}

function releasePlatformTag() {
	const { platform, arch } = process;
	if (platform === "darwin") return arch === "arm64" ? "macos-aarch64" : "macos-x64";
	if (platform === "win32") return arch === "arm64" ? "windows-aarch64" : "windows-x64";
	if (platform === "linux") return arch === "arm64" ? "linux-aarch64" : "linux-x64";
	return null;
}

// ─── 驱动清单 ───

const DRIVERS = [
	{
		key: "duckdb",
		label: "DuckDB Native Driver（API 数据源本机查询通道）",
		description: "dbx API 数据源的本地 SQL 执行引擎。执行 SELECT 等查询时由 dbx-mcp spawn 为 sidecar 进程。",
		envVar: "DBX_DUCKDB_DRIVER_PATH",
		binaryName: "duckdb_worker",
		releaseArtifact: (platTag) => `dbx-agent-duckdb-${platTag}${process.platform === "win32" ? ".exe" : ""}`,
	},
];

// ─── 进度状态（内存 Map，单进程生命周期足够） ───

const INSTALL_STATUS = new Map(); // key → { status, downloaded, total, error? }

function getInstallStatus(key) { return INSTALL_STATUS.get(key) ?? { status: "idle", downloaded: 0, total: 0 }; }
function setInstallStatus(key, val) { INSTALL_STATUS.set(key, val); }

// ─── 工具 ───

function driverDir(key) {
	return join(DRIVERS_ROOT, key, platformKey());
}
function driverBinary(key) {
	const d = DRIVERS.find((d) => d.key === key);
	return join(driverDir(key), d.binaryName);
}
function findDriver(key) { return DRIVERS.find((d) => d.key === key); }
function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }); }

// ─── 路由 ───

export function driverRoutes() {
	return [
		["/driver/status", "POST", true, async () => {
			const out = DRIVERS.map((d) => {
				const binary = driverBinary(d.key);
				const installed = existsSync(binary);
				let sizeBytes;
				if (installed) { try { sizeBytes = statSync(binary).size; } catch { /* ignore */ } }
				const platTag = releasePlatformTag();
				const installUrl = platTag ? `${DBX_AGENTS_LATEST}/${d.releaseArtifact(platTag)}` : null;
				return {
					key: d.key, label: d.label, installed, installedPath: installed ? binary : undefined,
					sizeBytes, envVar: d.envVar, description: d.description, expectedPath: binary,
					reason: installed ? undefined : "未检测到驱动可执行文件，点击「安装」从 dbx agents release 下载",
					downloadUrl: installUrl, installStatus: getInstallStatus(d.key),
				};
			});
			return { drivers: out };
		}],

		["/driver/install", "POST", true, async ({ body }) => {
			const { driverKey, url } = body || {};
			const driver = findDriver(driverKey);
			if (!driver) return { ok: false, error: `未知驱动: ${driverKey}` };

			const binary = driverBinary(driverKey);
			if (existsSync(binary)) {
				// 已安装 — 只返回现状，不重新下载
				return { ok: true, driverKey, installedPath: binary, note: "已存在" };
			}

			let downloadUrl = url;
			if (!downloadUrl) {
				const platTag = releasePlatformTag();
				if (!platTag) return { ok: false, driverKey, error: `不支持的平台: ${process.platform}-${process.arch}` };
				downloadUrl = `${DBX_AGENTS_LATEST}/${driver.releaseArtifact(platTag)}`;
			}

			// 检查是否已有正在进行的安装（同 key）
			const existing = getInstallStatus(driverKey);
			if (existing.status === "downloading" || existing.status === "installing") {
				return { ok: true, driverKey, note: "已在安装中", installStatus: existing };
			}

			// 立即标记 downloading — 前端立即能看到状态
			setInstallStatus(driverKey, { status: "downloading", downloaded: 0, total: 0 });

			// **异步执行** — 不阻塞 HTTP 响应，前端可轮询 /driver/status
			(async () => {
				try {
					ensureDir(driverDir(driverKey));
					await downloadFileStreaming(downloadUrl, binary, (downloaded, total) => {
						setInstallStatus(driverKey, {
							status: "downloading",
							downloaded,
							total,
							percent: total > 0 ? Math.round((downloaded / total) * 100) : undefined,
						});
					});
					setInstallStatus(driverKey, { status: "installing", downloaded: statSync(binary).size, total: statSync(binary).size });
					chmodSync(binary, 0o755);
					setInstallStatus(driverKey, { status: "done", downloaded: statSync(binary).size, total: statSync(binary).size });
				} catch (e) {
					setInstallStatus(driverKey, { status: "error", downloaded: 0, total: 0, error: e.message });
				}
			})();

			return {
				ok: true,
				driverKey,
				note: "下载已开始，轮询 /driver/status 查看进度",
				installStatus: { status: "downloading", downloaded: 0, total: 0 },
			};
		}],

		["/driver/install-status", "GET", true, async ({ query }) => {
			const key = query?.driverKey;
			if (!key) return { ok: false, error: "缺少 driverKey" };
			return { ok: true, driverKey: key, status: getInstallStatus(key) };
		}],

		["/driver/set-path", "POST", true, async ({ body }) => {
			const { driverKey, path } = body || {};
			const driver = findDriver(driverKey);
			if (!driver) return { ok: false, error: `未知驱动: ${driverKey}` };
			if (!path) return { ok: false, error: "缺少 path 参数" };
			if (!existsSync(path)) return { ok: false, error: `文件不存在: ${path}` };
			ensureDir(driverDir(driverKey));
			const dest = driverBinary(driverKey);
			try {
				const { copyFileSync } = await import("node:fs");
				copyFileSync(path, dest);
				chmodSync(dest, 0o755);
				setInstallStatus(driverKey, { status: "done", downloaded: statSync(dest).size, total: statSync(dest).size });
			} catch (e) {
				return { ok: false, driverKey, error: `复制失败: ${e.message}。可手动设置环境变量 ${driver.envVar}=${path}` };
			}
			return { ok: true, driverKey, path: dest };
		}],

		["/driver/reset-status", "POST", true, async ({ body }) => {
			const key = body?.driverKey;
			if (key) INSTALL_STATUS.delete(key);
			else INSTALL_STATUS.clear();
			return { ok: true };
		}],
	];
}

// ─── 流式下载（ReadableStream + progress callback + 60s timeout） ───

async function downloadFileStreaming(url, destPath, onProgress) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 60_000);
	let resp;
	try {
		resp = await fetch(url, { redirect: "follow", signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
	if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
	const total = Number(resp.headers.get("content-length") ?? 0);
	onProgress(0, total);
	if (!resp.body) throw new Error("响应无 body");

	const writer = createWriteStream(destPath);
	const reader = resp.body.getReader();
	let downloaded = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			writer.write(value);
			downloaded += value.byteLength;
			onProgress(downloaded, total || downloaded);
		}
		writer.end();
		await new Promise((res, rej) => writer.on("finish", res).on("error", rej));
	} catch (e) {
		try { writer.end(); } catch { /* ignore */ }
		throw e;
	}
}
