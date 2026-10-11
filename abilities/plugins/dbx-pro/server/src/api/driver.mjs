/**
 * driver.mjs — 驱动管理路由。
 *
 * 三个路由：
 *   POST /driver/status   列出所有托管驱动的安装状态
 *   POST /driver/install   下载安装指定驱动
 *   POST /driver/set-path  手动指定驱动路径
 *
 * 重要说明（2025-01-15 注）：
 *   dbx-mcp 需要的 `duckdb_worker` 是 dbx 自研 Rust 二进制（agents/drivers/duckdb），
 *   不是 DuckDB 官方 CLI。maomaochong-ai/dbx releases 只发 dbx-mcp，不发 driver。
 *   所以自动下载暂时回落到 **用户手动指定本地 binary 路径**。
 */

import { existsSync, mkdirSync, chmodSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIVERS_ROOT = join(homedir(), ".astravia-dbx-data", "drivers");

// ─── 平台映射（dbx Desktop 用的标签，不是 Node 的 process.platform） ───

/** Node platform → dbx 驱动下载平台标签 */
function detectPlatform() {
	const plat = process.platform;
	const arch = process.arch;
	if (plat === "darwin") {
		return arch === "arm64" ? "macos-aarch64" : "macos-x64";
	}
	if (plat === "win32") {
		return arch === "arm64" ? "windows-aarch64" : "windows-x64";
	}
	if (plat === "linux") {
		return arch === "arm64" ? "linux-aarch64" : "linux-x64";
	}
	return null;
}

/** Node platform key（用于本地驱动存储目录） */
function platformKey() {
	const plat = process.platform;
	const arch = process.arch;
	if (plat === "darwin") return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
	if (plat === "win32") return arch === "arm64" ? "win32-arm64" : "win32-x64";
	if (plat === "linux") return arch === "arm64" ? "linux-arm64" : "linux-x64";
	return "unknown";
}

// ─── 驱动清单 ───

/**
 * dbx-mcp 会检查这些环境变量；驱动安装后，collectDriverEnv() 会扫描 drivers 目录注入。
 *
 * 注意：duckdb 需要的是 dbx 自研的 duckdb_worker（agents/drivers/duckdb 编译产物），
 * 不是 DuckDB 官方 CLI。官方 CLI 协议不兼容，会导致 dbx-mcp worker 启动失败。
 */
const DRIVERS = [
	{
		key: "duckdb",
		label: "DuckDB Worker（API 数据源本机查询通道）",
		description: "dbx API 数据源的本地 SQL 执行引擎，用于执行 SELECT 等查询。",
		envVar: "DBX_DUCKDB_DRIVER_PATH",
		binaryName: "duckdb_worker",
	},
];

// ─── 工具函数 ───

function driverDir(key) {
	return join(DRIVERS_ROOT, key, platformKey());
}

function driverBinary(key) {
	return join(driverDir(key), DRIVERS.find((d) => d.key === key).binaryName);
}

function ensureDir(path) {
	if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

// ─── 路由处理器 ───

/** POST /driver/status */
export function handleDriverStatus(req, res) {
	const out = DRIVERS.map((d) => {
		const binary = driverBinary(d.key);
		const installed = existsSync(binary);
		let sizeBytes;
		if (installed) {
			try { sizeBytes = statSync(binary).size; } catch { /* ignore */ }
		}
		const expectedPath = binary;
		return {
			key: d.key,
			label: d.label,
			installed,
			installedPath: installed ? binary : undefined,
			sizeBytes,
			envVar: d.envVar,
			description: d.description,
			expectedPath,
			reason: installed ? undefined : "未检测到驱动可执行文件",
		};
	});
	res.json({ drivers: out });
}

/** POST /driver/install — 目前只支持手动 set-path；自动下载等 duckdb_worker 有公开 release 源再恢复 */
export async function handleDriverInstall(req, res) {
	const { driverKey, url } = req.body || {};
	const driver = DRIVERS.find((d) => d.key === driverKey);
	if (!driver) {
		res.status(400).json({ ok: false, error: `未知驱动: ${driverKey}` });
		return;
	}

	// 检查本地是否已安装
	const binary = driverBinary(driverKey);
	if (existsSync(binary)) {
		res.json({ ok: true, driverKey, installedPath: binary, note: "已存在" });
		return;
	}

	// 目前无可用自动下载源（duckdb_worker 未公开）
	// 如果用户给了自定义 URL，尝试下载
	if (url) {
		try {
			ensureDir(driverDir(driverKey));
			await downloadFile(url, binary);
			chmodSync(binary, 0o755);
			res.json({ ok: true, driverKey, installedPath: binary, note: "从用户指定 URL 下载" });
		} catch (e) {
			res.status(502).json({ ok: false, driverKey, error: `下载失败: ${e.message}` });
		}
		return;
	}

	res.status(501).json({
		ok: false,
		driverKey,
		error:
			"自动下载暂不可用：duckdb_worker 是 dbx 自研 Rust 二进制，目前无公开 release。" +
			"请通过「驱动管理 → 指定路径」手动指向已编译的 binary，或设置 " + driver.envVar + " 环境变量。",
	});
}

/** POST /driver/set-path */
export async function handleDriverSetPath(req, res) {
	const { driverKey, path } = req.body || {};
	const driver = DRIVERS.find((d) => d.key === driverKey);
	if (!driver) {
		res.status(400).json({ ok: false, error: `未知驱动: ${driverKey}` });
		return;
	}
	if (!path) {
		res.status(400).json({ ok: false, error: "缺少 path 参数" });
		return;
	}
	if (!existsSync(path)) {
		res.status(404).json({ ok: false, error: `文件不存在: ${path}` });
		return;
	}

	// 复制到标准驱动目录（方便 collectDriverEnv 扫描）
	ensureDir(driverDir(driverKey));
	const dest = driverBinary(driverKey);
	try {
		// 用 cp 而不是 rename，因为源可能在只读位置
		await copyFile(path, dest);
		chmodSync(dest, 0o755);
	} catch (e) {
		// 如果 cp 也失败（权限），至少返回原始路径让用户手动设置 env
		res.status(500).json({
			ok: false,
			driverKey,
			error: `复制失败: ${e.message}。可手动设置环境变量 ${driver.envVar}=${path}`,
		});
		return;
	}

	res.json({ ok: true, driverKey, path: dest });
}

// ─── 辅助函数 ───

async function downloadFile(url, destPath) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	const { writeFileSync } = await import("node:fs");
	writeFileSync(destPath, buf);
}

async function copyFile(src, dest) {
	const { copyFileSync } = await import("node:fs");
	copyFileSync(src, dest);
}

// ─── 导出路由 ───

export function registerDriverRoutes(app) {
	app.post("/driver/status", handleDriverStatus);
	app.post("/driver/install", handleDriverInstall);
	app.post("/driver/set-path", handleDriverSetPath);
}
