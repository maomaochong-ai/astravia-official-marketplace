/**
 * reveal-item —— 在平台文件管理器中定位并选中指定文件（「打开所在文件夹」）。
 *
 * 为什么走引擎服务：宿主对 community 信任等级的插件拒绝 official shell 能力
 *（shell.showItemInFolder 会抛 "Plugin official capability access denied"），
 * 而导出文件落在用户通过系统保存框自选的目录、不在 workspace 树内，
 * fileExplorer.reveal 同样无法使用。该操作由插件自有的 host-node 回环服务执行，
 * 路由带 token 鉴权；命令以 spawn + 参数数组方式启动（无 shell），不存在注入面。
 *
 * - macOS  : open -R <path>               Finder 定位并选中文件
 * - Windows: explorer.exe /select,<path>  资源管理器选中（退出码恒为 1，不据此判失败）
 * - Linux  : xdg-open <dirname>           打开所在文件夹（多数文件管理器无 --select）
 */

import path from "node:path";
import { spawn } from "node:child_process";

export const REVEAL_PATH_MAX_LENGTH = 4096;
const REVEAL_TIMEOUT_MS = 5000;

/** 路径白名单校验：非空、绝对路径、无空字节、长度受限。 */
export function validateRevealPath(fsPath) {
	if (typeof fsPath !== "string" || fsPath.trim().length === 0) {
		throw new Error("path 必须是非空字符串");
	}
	const target = fsPath.trim();
	if (target.length > REVEAL_PATH_MAX_LENGTH) {
		throw new Error(`path 过长（上限 ${REVEAL_PATH_MAX_LENGTH} 字符）`);
	}
	if (target.includes("\0")) {
		throw new Error("path 包含非法空字节");
	}
	if (!path.isAbsolute(target)) {
		throw new Error("path 必须是绝对路径");
	}
	return target;
}

/**
 * 按平台构造定位命令（纯函数，便于单测）。
 * @returns {{command: string, args: string[], ignoreExitCode?: boolean}}
 */
export function selectRevealCommand(platform, fsPath) {
	const target = validateRevealPath(fsPath);
	switch (platform) {
		case "darwin":
			return { command: "open", args: ["-R", target] };
		case "win32":
			// explorer 即使成功退出码也常为 1，必须忽略退出码。
			return { command: "explorer.exe", args: [`/select,${target}`], ignoreExitCode: true };
		default:
			// Linux/其它 Unix：文件管理器选择文件没有统一接口，退化为打开所在目录。
			return { command: "xdg-open", args: [path.dirname(target)] };
	}
}

/** 启动定位命令；进程错误才判失败，超时按「命令已派发」成功处理。 */
export function runRevealCommand(spec, timeoutMs = REVEAL_TIMEOUT_MS) {
	return new Promise((resolve, reject) => {
		let child;
		try {
			child = spawn(spec.command, spec.args, { stdio: "ignore", windowsHide: true });
		} catch (e) {
			reject(new Error(`无法启动文件管理器：${e?.message ?? String(e)}`));
			return;
		}
		const timer = setTimeout(() => {
			try {
				child.kill();
			} catch {}
			resolve();
		}, timeoutMs);
		child.on("error", (e) => {
			clearTimeout(timer);
			reject(new Error(`无法启动文件管理器：${e?.message ?? String(e)}`));
		});
		child.on("exit", (code) => {
			clearTimeout(timer);
			if (spec.ignoreExitCode || code === 0) {
				resolve();
			} else {
				reject(new Error(`文件管理器命令退出码 ${code}`));
			}
		});
	});
}
