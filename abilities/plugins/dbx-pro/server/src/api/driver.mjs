/**
 * driver.mjs — 驱动管理路由（request-router 元组风格，与 connections/query 等一致）。
 *
 * 路由（无 /api 前缀，由 request-router 统一聚合）：
 *   POST /driver/status   列出所有托管驱动的安装状态
 *   POST /driver/install   下载安装指定驱动（异步，前端轮询进度）
 *   POST /driver/set-path  手动指定驱动路径（复制到标准驱动目录）
 *   GET  /driver/install-status   查询单驱动安装状态（轮询专用）
 *   POST /driver/reset-status     清除安装状态
 *
 * DuckDB 驱动背景：
 *   dbx-mcp 执行 API 数据源查询时需要 `duckdb_worker`——这其实是
 *   dbx Desktop 从 agents-release CI 产出的 `dbx-duckdb-driver`
 *   Rust binary。产物命名：
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
	readFileSync,
	writeFileSync,
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

// ─── 进度状态（持久化到磁盘！避免进程重启丢失） ───
// 之前用内存 Map，进程重启（插件热重载 / IDE 重启）状态就丢了，前端看到的就是
// "运行中" → "又回到安装态"。修复：用状态文件 + 内存 Map 双写。

const STATUS_FILE = join(DRIVERS_ROOT, ".install-status.json");

function ensureDriversRoot() {
	if (!existsSync(DRIVERS_ROOT)) mkdirSync(DRIVERS_ROOT, { recursive: true });
}

function loadStatuses() {
	try {
		if (!existsSync(STATUS_FILE)) return new Map();
		const raw = readFileSync(STATUS_FILE, "utf-8");
		const obj = JSON.parse(raw);
		const m = new Map();
		for (const [k, v] of Object.entries(obj)) m.set(k, v);
		return m;
	} catch { return new Map(); }
}

function saveStatuses(map) {
	try {
		ensureDriversRoot();
		const obj = Object.fromEntries(map);
		writeFileSync(STATUS_FILE, JSON.stringify(obj, null, 2));
	} catch { /* 磁盘写不进去就算了 */ }
}

const INSTALL_STATUS = loadStatuses();

function getInstallStatus(key) { return INSTALL_STATUS.get(key) ?? { status: "idle", downloaded: 0, total: 0 }; }
function setInstallStatus(key, val) {
	INSTALL_STATUS.set(key, val);
	saveStatuses(INSTALL_STATUS);
}

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
				const st = getInstallStatus(d.key);
				// 进程重启后修复：磁盘上有二进制 + status 还是 downloading/installing → 修正为 done
				if (installed && (st.status === "downloading" || st.status === "installing")) {
					const finalSt = { status: "done", downloaded: sizeBytes ?? 0, total: sizeBytes ?? 0 };
					setInstallStatus(d.key, finalSt);
					return {
						key: d.key, label: d.label, installed, installedPath: binary,
						sizeBytes, envVar: d.envVar, description: d.description, expectedPath: binary,
						reason: undefined, downloadUrl: installUrl, installStatus: finalSt,
					};
				}
				// 进程重启后清理：磁盘没二进制 + status 不是 idle 超过 10 分钟 → 重置
				if (!installed && st.status !== "idle" && st.startedAt && Date.now() - st.startedAt > 10 * 60 * 1000) {
					setInstallStatus(d.key, { status: "idle", downloaded: 0, total: 0 });
				}
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
				setInstallStatus(driverKey, { status: "done", downloaded: statSync(binary).size, total: statSync(binary).size });
				return { ok: true, driverKey, installedPath: binary, note: "已存在", installStatus: getInstallStatus(driverKey) };
			}

			let downloadUrl = url;
			if (!downloadUrl) {
				const platTag = releasePlatformTag();
				if (!platTag) return { ok: false, driverKey, error: `不支持的平台: ${process.platform}-${process.arch}` };
				downloadUrl = `${DBX_AGENTS_LATEST}/${driver.releaseArtifact(platTag)}`;
			}

			// 检查是否已有正在进行的安装
			const existing = getInstallStatus(driverKey);
			if (existing.status === "downloading" || existing.status === "installing") {
				return { ok: true, driverKey, note: "已在安装中", installStatus: existing };
			}

			// 立即标记 downloading + 持久化 + 记录 startedAt
			setInstallStatus(driverKey, { status: "downloading", downloaded: 0, total: 0, startedAt: Date.now() });
			const startedAt = Date.now();

			// 异步执行 — 不阻塞 HTTP 响应
			(async () => {
				try {
					ensureDir(driverDir(driverKey));
					await downloadFileStreaming(downloadUrl, binary, (downloaded, total) => {
						setInstallStatus(driverKey, {
							status: "downloading",
							downloaded,
							total,
							percent: total > 0 ? Math.round((downloaded / total) * 100) : undefined,
							startedAt,
						});
					});
					setInstallStatus(driverKey, {
						status: "installing",
						downloaded: statSync(binary).size,
						total: statSync(binary).size,
						startedAt,
					});
					chmodSync(binary, 0o755);
					setInstallStatus(driverKey, {
						status: "done",
						downloaded: statSync(binary).size,
						total: statSync(binary).size,
						startedAt,
					});
				} catch (e) {
					setInstallStatus(driverKey, {
						status: "error",
						downloaded: INSTALL_STATUS.get(driverKey)?.downloaded ?? 0,
						total: INSTALL_STATUS.get(driverKey)?.total ?? 0,
						error: e.message,
						startedAt,
					});
				}
			})();

			return {
				ok: true,
				driverKey,
				note: "下载已开始，轮询 /driver/status 查看进度",
				installStatus: getInstallStatus(driverKey),
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
			if (!driver) return { ok: false, driverKey, error: `未知驱动: ${driverKey}` };
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
			saveStatuses(INSTALL_STATUS);
			return { ok: true };
		}],
	];
}

// ─── 流式下载（ReadableStream + progress callback + 无硬超时） ───
// 之前 60s AbortController 对 GitHub release 跨洋下载根本不够，
// 直接移除硬超时，让下载自然结束。进程重启时状态持久化不丢。

async function downloadFileStreaming(url, destPath, onProgress) {
	const resp = await fetch(url, { redirect: "follow" });
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
