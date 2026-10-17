/**
 * 一键安装：只有「装完立刻能被 REA 用到」的工具才给按钮。
 *
 * 两种通道：
 *   rea    `rea setup --yes --installHopper`（REA 官方无人值守安装）
 *   brew   `brew install <formula>`（装完在 PATH 上，REA 直接能调）
 *
 * 其余工具（Ghidra / jadx / gdb / cutter…）不给按钮 —— 装完还要设环境变量或另外
 * 配置，点了也是白点。它们只显示可复制命令，说明里写清下一步。
 *
 * 只由用户点击触发，永远不在后台自动装。
 */

import { useCallback, useRef, useState } from "react";
import type { PluginCommandRunResult } from "@astravia-org/plugin-sdk";
import { installRecipeFor } from "../live/tool-install";

const INSTALL_TIMEOUT_MS = 10 * 60_000;

export type InstallTone = "success" | "danger";

export interface ToolInstallDeps {
	readonly runRea: (
		args: readonly string[],
		options: { cwd?: string; timeoutMs: number },
	) => Promise<PluginCommandRunResult>;
	/** 直接跑外部命令（brew）；null 表示没有命令执行授权。 */
	readonly runCommand: ((file: string, args: readonly string[]) => Promise<PluginCommandRunResult>) | null;
	readonly cwd: string | null;
	/** 安装结束（无论成败）后重新探测 + 复检 doctor。 */
	readonly onFinished: () => void;
}

export interface ToolInstall {
	/** 正在安装的工具 id。 */
	readonly installingId: string | null;
	readonly message: string | null;
	readonly tone: InstallTone | null;
	canInstall(id: string): boolean;
	install(id: string): void;
}

export function useToolInstall(deps: ToolInstallDeps): ToolInstall {
	const depsRef = useRef(deps);
	depsRef.current = deps;
	const [installingId, setInstallingId] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [tone, setTone] = useState<InstallTone | null>(null);
	const busy = useRef(false);

	const canInstall = useCallback((id: string): boolean => {
		const recipe = installRecipeFor(id);
		if (recipe === null) return false;
		if (recipe.kind === "rea") return true;
		if (recipe.kind === "brew") return depsRef.current.runCommand !== null;
		return false;
	}, []);

	const install = useCallback((id: string): void => {
		const recipe = installRecipeFor(id);
		if (recipe === null || recipe.kind === "manual" || busy.current) return;
		const current = depsRef.current;
		if (recipe.kind === "brew" && current.runCommand === null) return;

		busy.current = true;
		setInstallingId(id);
		setMessage(null);
		setTone(null);

		void (async () => {
			try {
				const result =
					recipe.kind === "rea"
						? await current.runRea(recipe.args ?? [], {
								...(current.cwd ? { cwd: current.cwd } : {}),
								timeoutMs: INSTALL_TIMEOUT_MS,
							})
						: await current.runCommand?.("brew", recipe.args ?? []);
				if (!result) {
					setTone("danger");
					setMessage("no command channel");
				} else if (result.exitCode === 0) {
					setTone("success");
					setMessage(null);
				} else {
					setTone("danger");
					setMessage((result.stderr || result.stdout || `exit ${result.exitCode}`).trim().slice(0, 240));
				}
			} catch (error) {
				setTone("danger");
				setMessage(error instanceof Error ? error.message : String(error));
			} finally {
				busy.current = false;
				setInstallingId(null);
				depsRef.current.onFinished();
			}
		})();
	}, []);

	return { installingId, message, tone, canInstall, install };
}
