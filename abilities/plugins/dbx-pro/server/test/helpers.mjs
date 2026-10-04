/**
 * server 测试共用工具。
 *
 * 引擎集成测试只在「当前平台的 dbx-mcp 二进制真实存在」时运行：
 * CI 的 linux runner 没有预编译二进制，这类测试显式 skip 并说明原因，
 * 而不是失败或假通过。
 */

import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = resolve(HERE, "..");
export const BIN_DIR = join(SERVER_ROOT, "bin");

/** 与 dbx-mcp-client.detectPlatform 相同的平台标签推导。 */
export function currentPlatformTag() {
	const platform = process.platform;
	const arch = process.arch;
	if (platform === "darwin") return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
	if (platform === "win32" && arch === "x64") return "win32-x64";
	return null;
}

const BINARY_NAME = {
	"darwin-arm64": "dbx-mcp-darwin-arm64",
	"darwin-x64": "dbx-mcp-darwin-x64",
	"win32-x64": "dbx-mcp-win-x64.exe",
};

/** 当前平台的二进制路径（可能不存在）。 */
export function platformBinaryPath() {
	const tag = currentPlatformTag();
	if (!tag) return null;
	return join(BIN_DIR, BINARY_NAME[tag]);
}

/** 集成测试闸门：true 表示可以真正 spawn 引擎。 */
export function engineBinaryAvailable() {
	const path = platformBinaryPath();
	if (!path || !existsSync(path)) return false;
	// 与 build-engine 相同的合理性检查。
	return statSync(path).size > 1_000_000;
}

export const engineSkipMessage =
	`当前平台 ${process.platform}-${process.arch} 无 dbx-mcp 二进制，跳过引擎集成测试`;
