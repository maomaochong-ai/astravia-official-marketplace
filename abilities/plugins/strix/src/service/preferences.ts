/**
 * 面板级偏好：用哪种执行环境（ADR 0013）。
 *
 * 为什么存在服务端而不是 localStorage：**agent 也要读它**。用户在面板上把环境选成
 * 「容器（docker）」，接着在对话里说「开始扫描」，`strix_sandbox_start` 不传 mode 时必须
 * 落在 docker 上——偏好只有一份，写在服务侧才不会出现"面板显示容器、实际跑在本机"。
 *
 * 三种取值：
 *  - `host`：本机执行（无容器隔离），默认；
 *  - `docker`：容器内执行，需要 docker 守护进程可用；
 *  - `auto`：有 docker 就用容器，没有就本机——**显式的选择**而不是静默回退。
 *
 * 一个约束：偏好只影响**下一次** sandbox 启动。已经在跑的扫描不中途换环境（ADR 0002：
 * environment mode 属于会话快照）。
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const ENVIRONMENT_MODES = ["auto", "host", "docker"] as const;
export type EnvironmentMode = (typeof ENVIRONMENT_MODES)[number];

export interface Preferences {
	environmentMode: EnvironmentMode;
	/** 最近一次由面板发起的安装尝试，用于「装完刷新」这一句有据可依。 */
	lastInstall?: { command: string; at: string; ok: boolean; detail?: string };
}

const DEFAULT: Preferences = { environmentMode: "host" };

function file(dataDir: string): string {
	return join(dataDir, "preferences.json");
}

export function normalizeMode(value: unknown, fallback: EnvironmentMode = "host"): EnvironmentMode {
	const text = String(value ?? "").trim().toLowerCase();
	return (ENVIRONMENT_MODES as readonly string[]).includes(text) ? (text as EnvironmentMode) : fallback;
}

export async function readPreferences(dataDir: string): Promise<Preferences> {
	try {
		const parsed = JSON.parse(await readFile(file(dataDir), "utf8")) as Partial<Preferences>;
		return { ...DEFAULT, ...parsed, environmentMode: normalizeMode(parsed.environmentMode) };
	} catch {
		return { ...DEFAULT };
	}
}

export async function writePreferences(dataDir: string, patch: Partial<Preferences>): Promise<Preferences> {
	const current = await readPreferences(dataDir);
	const next: Preferences = {
		...current,
		...(patch.environmentMode === undefined ? {} : { environmentMode: normalizeMode(patch.environmentMode) }),
		...(patch.lastInstall === undefined ? {} : { lastInstall: patch.lastInstall }),
	};
	await mkdir(dataDir, { recursive: true });
	await writeFile(file(dataDir), `${JSON.stringify(next, null, 2)}\n`, "utf8");
	return next;
}

/**
 * 装 docker 的命令，按平台。
 *
 * 这不是"帮用户装好"——安装器会要管理员权限、可能重启、可能装一个几 GB 的 GUI。
 * 面板做的是**把命令摆出来并可代跑**，剩下的是用户与宿主的事（ADR 0013 的代价一节）。
 */
export function dockerInstallCommand(platform: NodeJS.Platform = process.platform): { command: string; argv: string[] } {
	if (platform === "win32") {
		return {
			command: "powershell",
			argv: [
				"-NoProfile",
				"-Command",
				"winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements",
			],
		};
	}
	if (platform === "darwin") {
		return { command: "sh", argv: ["-c", "brew install --cask docker"] };
	}
	return { command: "sh", argv: ["-c", "echo 'Linux 请用发行版的包管理器安装 docker（需要 root），例如: sudo apt-get install -y docker.io'"] };
}
