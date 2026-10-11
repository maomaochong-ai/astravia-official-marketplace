/**
 * driver.mjs — 驱动管理 API（DuckDB / Redis / ClickHouse 等 managed driver 检查与安装）。
 *
 * POST /driver/status      → 返回各 managed driver 的安装状态
 * POST /driver/install     → 下载/安装指定驱动
 * POST /driver/set-path    → 手动设置驱动路径（如 DBX_DUCKDB_DRIVER_PATH）
 *
 * 设计原则：
 *   - server 侧零新依赖：下载用 node:https + zlib（tar.zst 解压也走 zlib）
 *   - 驱动存放位置：~/.astravia-dbx-data/drivers/<db_type>/<platform>/
 *   - dbx-mcp spawn 时 DbxMcpClient 会自动扫描该目录并注入 DBX_DUCKDB_DRIVER_PATH
 */
import { existsSync, mkdirSync, statSync, writeFileSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { engineError } from "../engine/protocol.mjs";

/** 驱动存放根目录（与 dbx-mcp 的 DBX_DATA_DIR 同级） */
function resolveDriversDir(dataDir = null) {
	const baseDir = dataDir ?? join(homedir(), ".astravia-dbx-data");
	return join(baseDir, "drivers");
}

/** 平台标签 — 与 dbx-mcp-client.mjs 的 detectPlatform 对齐 */
function detectPlatformTag() {
	if (process.platform === "darwin") {
		return process.arch === "arm64" ? "darwin-arm64" : "darwin-x64";
	}
	if (process.platform === "win32" && process.arch === "x64") return "win32-x64";
	return null;
}

/**
 * 已支持的 managed driver 清单。
 * key 与数据库类型一致，用于 dbx-mcp 里的驱动查找。
 */
const MANAGED_DRIVERS = [
	{
		key: "duckdb",
		label: "DuckDB",
		description: "本地 OLAP 分析引擎（API 接入数据源查询的底层引擎）",
		envVar: "DBX_DUCKDB_DRIVER_PATH",
		// 原生驱动可执行文件名（解压后的实际文件）
		binaryName: process.platform === "win32" ? "duckdb_worker.exe" : "duckdb_worker",
		// dbx 官方 release 命名格式：dbx-agent-duckdb-{platform}.tar.zst
		// 实际下载时可让用户覆盖 URL（不同版本可能有变化）
		artifactPattern: (platform) => `dbx-agent-duckdb-${platform}.tar.zst`,
		defaultUrls: [
			// dbx 官方 CDN（优先）
			(platform) => `https://dl.dbxio.com/cn/drivers/dbx-agent-duckdb-${platform}.tar.zst`,
			// dbx GitHub Releases（回退）
			(platform) => `https://github.com/dbxio/dbx/releases/latest/download/dbx-agent-duckdb-${platform}.tar.zst`,
		],
	},
];

/** 检查单个驱动是否已安装 */
function checkDriverInstalled(driverKey, dataDir = null) {
	const platform = detectPlatformTag();
	if (!platform) {
		return { key: driverKey, installed: false, reason: `不支持的平台 ${process.platform}-${process.arch}` };
	}
	const driver = MANAGED_DRIVERS.find((d) => d.key === driverKey);
	if (!driver) return { key: driverKey, installed: false, reason: `未知驱动 ${driverKey}` };

	// 驱动目录：~/.astravia-dbx-data/drivers/<key>/<platform>/
	const driverDir = join(resolveDriversDir(dataDir), driver.key, platform);
	const driverBinary = join(driverDir, driver.binaryName);

	if (!existsSync(driverBinary)) {
		return {
			key: driverKey,
			label: driver.label,
			installed: false,
			reason: "驱动文件不存在",
			expectedPath: driverBinary,
			envVar: driver.envVar,
			description: driver.description,
		};
	}

	try {
		const st = statSync(driverBinary);
		return {
			key: driverKey,
			label: driver.label,
			installed: true,
			path: driverBinary,
			sizeBytes: st.size,
			modifiedAt: st.mtimeMs,
			envVar: driver.envVar,
			description: driver.description,
		};
	} catch (e) {
		return { key: driverKey, installed: false, reason: `无法访问驱动: ${e.message}` };
	}
}

/** 下载 + 解压（tar.zst）驱动到目标目录 */
async function downloadAndExtract(url, targetDir) {
	mkdirSync(targetDir, { recursive: true });
	// 这里实现简化版：用 node:https 下载 + zlib 解压 tar.zst
	// 完整实现需要引入 tar 库，先用 shell fallback（dbx-mcp 运行的机器应该有 tar）
	const https = await import("node:https").then((m) => m.default);
	const http = await import("node:http").then((m) => m.default);
	const { spawnSync } = await import("node:child_process");

	return new Promise((resolve, reject) => {
		const tmpFile = join(targetDir, "_download_tmp.tar.zst");
		const stream = createWriteStream(tmpFile);
		const download = (currentUrl, redirectCount = 0) => {
			if (redirectCount > 5) return reject(new Error("下载重定向过多"));
			const mod = currentUrl.startsWith("https") ? https : http;
			mod.get(currentUrl, (res) => {
				if (res.statusCode === 302 || res.statusCode === 301) {
					return download(res.headers.location, redirectCount + 1);
				}
				if (res.statusCode !== 200) {
					return reject(new Error(`下载失败: HTTP ${res.statusCode}`));
				}
				res.pipe(stream);
				stream.on("finish", () => {
					stream.close();
					// 解压 tar.zst（用系统 tar）
					const { status, stderr } = spawnSync("tar", ["--zstd", "-xf", tmpFile, "-C", targetDir]);
					if (status !== 0) {
						// fallback: 尝试 --zstd 不可用时用 zstd 单独解压
						const zstdResult = spawnSync("zstd", ["-d", "-f", tmpFile, "-o", join(targetDir, "_download_tmp.tar")]);
						if (zstdResult.status === 0) {
							const tarResult = spawnSync("tar", ["-xf", join(targetDir, "_download_tmp.tar"), "-C", targetDir]);
							if (tarResult.status !== 0) {
								return reject(new Error(`解压失败: ${tarResult.stderr.toString()}`));
							}
						} else {
							return reject(new Error(`解压失败，请安装 zstd: ${stderr?.toString() ?? ""}`));
						}
					}
					resolve(targetDir);
				});
			}).on("error", reject);
		};
		download(url);
	});
}

export function driverRoutes(ctx) {
	return [
		/** POST /driver/status —— 列出所有 managed driver 的安装状态 */
		["/driver/status", "POST", false, async ({ body }) => {
			const requestedKey = body?.driverKey;
			const dataDir = ctx.dataDir ?? null;
			if (requestedKey) {
				return { drivers: [checkDriverInstalled(requestedKey, dataDir)] };
			}
			const drivers = MANAGED_DRIVERS.map((d) => checkDriverInstalled(d.key, dataDir));
			return { drivers };
		}],

		/** POST /driver/install —— 下载安装指定驱动 */
		["/driver/install", "POST", false, async ({ body }) => {
			const driverKey = body?.driverKey ?? body?.key;
			if (!driverKey) throw engineError("BAD_REQUEST", "缺少 driverKey");
			const driver = MANAGED_DRIVERS.find((d) => d.key === driverKey);
			if (!driver) throw engineError("BAD_REQUEST", `未知驱动 ${driverKey}`);

			const platform = detectPlatformTag();
			if (!platform) throw engineError("BAD_REQUEST", `不支持的平台 ${process.platform}-${process.arch}`);

			const dataDir = ctx.dataDir ?? null;
			const targetDir = join(resolveDriversDir(dataDir), driver.key, platform);

			// 下载 URL：用户指定优先，否则走默认 CDN
			const userUrl = body?.url;
			const urlsToTry = userUrl
				? [userUrl]
				: driver.defaultUrls.map((fn) => fn(platform));

			let lastError = null;
			for (const url of urlsToTry) {
				try {
					await downloadAndExtract(url, targetDir);
					const result = checkDriverInstalled(driverKey, dataDir);
					if (!result.installed) {
						throw new Error(`驱动解压后未找到 ${driver.binaryName}（期望路径 ${result.expectedPath}）`);
					}
					// 重启 dbx-mcp 子进程让新驱动生效
					try { await ctx.disposeDbxMcpClient?.(); } catch {}
					return { ok: true, driverKey, installedPath: result.path };
				} catch (e) {
					lastError = e;
				}
			}
			throw engineError("DRIVER_INSTALL_FAILED", `驱动安装失败: ${lastError?.message ?? "未知错误"}`, String(lastError));
		}],

		/** POST /driver/set-path —— 手动指定驱动路径 */
		["/driver/set-path", "POST", false, async ({ body }) => {
			const driverKey = body?.driverKey;
			const path = body?.path;
			if (!driverKey || !path) throw engineError("BAD_REQUEST", "缺少 driverKey 或 path");
			const driver = MANAGED_DRIVERS.find((d) => d.key === driverKey);
			if (!driver) throw engineError("BAD_REQUEST", `未知驱动 ${driverKey}`);
			if (!existsSync(path)) throw engineError("BAD_REQUEST", `路径不存在: ${path}`);

			// 创建 symlink 到驱动目录，让 DbMcpClient 自动扫描到
			const platform = detectPlatformTag();
			const dataDir = ctx.dataDir ?? null;
			const driverDir = join(resolveDriversDir(dataDir), driver.key, platform);
			mkdirSync(driverDir, { recursive: true });
			const destBinary = join(driverDir, driver.binaryName);

			// 写一个配置文件（symlink 在某些场景有权限问题）
			writeFileSync(join(driverDir, ".path"), path, "utf-8");
			// 如果目标可执行，也直接 cp 一份（或 symlink）
			try {
				const { symlinkSync, chmodSync } = await import("node:fs");
				if (existsSync(destBinary)) { try { require("node:fs").unlinkSync(destBinary); } catch {} }
				symlinkSync(path, destBinary);
				try { chmodSync(destBinary, 0o755); } catch {}
			} catch { /* symlink 失败没关系，配置文件已经够了 */ }

			// 重启 dbx-mcp
			try { await ctx.disposeDbxMcpClient?.(); } catch {}
			return { ok: true, driverKey, path };
		}],
	];
}

export { MANAGED_DRIVERS, resolveDriversDir, detectPlatformTag, checkDriverInstalled };
