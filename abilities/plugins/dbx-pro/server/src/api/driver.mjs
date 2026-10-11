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
	writeFileSync,
	copyFileSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const DRIVERS_ROOT = join(homedir(), ".astravia-dbx-data", "drivers");
const DBX_AGENTS_LATEST = "https://github.com/t8y2/dbx/releases/download/agents-latest";

// ─── 平台映射（两个不同用途的标签） ───

/** 本地驱动存储目录用的平台 key，与 dbx-mcp-client.detectPlatform() 对齐 */
function platformKey() {
	const { platform, arch } = process;
	if (platform === "darwin") return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
	if (platform === "win32") return arch === "arm64" ? "win32-arm64" : "win32-x64";
	if (platform === "linux") return arch === "arm64" ? "linux-arm64" : "linux-x64";
	return "unknown";
}

/** dbx agents release CI 用的平台标签 */
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
		binaryName: "duckdb_worker", // 本地存储时用的名字（方便 collectDriverEnv 扫描）
		releaseArtifact: (platTag) => `dbx-agent-duckdb-${platTag}${process.platform === "win32" ? ".exe" : ""}`,
	},
];

// ─── 工具函数 ───

function driverDir(key) {
	return join(DRIVERS_ROOT, key, platformKey());
}

function driverBinary(key) {
	const d = DRIVERS.find((d) => d.key === key);
	return join(driverDir(key), d.binaryName);
}

function findDriver(key) {
	return DRIVERS.find((d) => d.key === key);
}

function ensureDir(path) {
	if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

// ─── 路由（request-router 元组风格） ───

export function driverRoutes() {
	return [
		["/driver/status", "POST", true, async () => {
			const out = DRIVERS.map((d) => {
				const binary = driverBinary(d.key);
				const installed = existsSync(binary);
				let sizeBytes;
				if (installed) {
					try { sizeBytes = statSync(binary).size; } catch { /* ignore */ }
				}
				const platTag = releasePlatformTag();
				const installUrl = platTag ? `${DBX_AGENTS_LATEST}/${d.releaseArtifact(platTag)}` : null;
				return {
					key: d.key,
					label: d.label,
					installed,
					installedPath: installed ? binary : undefined,
					sizeBytes,
					envVar: d.envVar,
					description: d.description,
					expectedPath: binary,
					reason: installed ? undefined : "未检测到驱动可执行文件，点击「安装」从 dbx agents release 下载",
					downloadUrl: installUrl,
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
				return { ok: true, driverKey, installedPath: binary, note: "已存在" };
			}

			let downloadUrl = url;
			if (!downloadUrl) {
				const platTag = releasePlatformTag();
				if (!platTag) {
					return { ok: false, driverKey, error: `不支持的平台: ${process.platform}-${process.arch}` };
				}
				downloadUrl = `${DBX_AGENTS_LATEST}/${driver.releaseArtifact(platTag)}`;
			}

			try {
				ensureDir(driverDir(driverKey));
				await downloadFile(downloadUrl, binary);
				chmodSync(binary, 0o755);
				return {
					ok: true,
					driverKey,
					installedPath: binary,
					note: `从 ${downloadUrl} 下载成功`,
				};
			} catch (e) {
				return { ok: false, driverKey, error: `下载失败: ${e.message}`, url: downloadUrl };
			}
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
				copyFileSync(path, dest);
				chmodSync(dest, 0o755);
			} catch (e) {
				return {
					ok: false,
					driverKey,
					error: `复制失败: ${e.message}。可手动设置环境变量 ${driver.envVar}=${path}`,
				};
			}
			return { ok: true, driverKey, path: dest };
		}],
	];
}

// ─── 辅助函数 ───

async function downloadFile(url, destPath) {
	const resp = await fetch(url, { redirect: "follow" });
	if (!resp.ok) {
		throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
	}
	const buf = Buffer.from(await resp.arrayBuffer());
	writeFileSync(destPath, buf);
}
