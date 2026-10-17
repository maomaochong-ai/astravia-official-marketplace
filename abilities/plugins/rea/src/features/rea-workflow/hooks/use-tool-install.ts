/**
 * 一键安装：调用 REA 官方的无人值守安装通道（`rea setup --yes --installHopper`）。
 *
 * 只由用户点击触发，不在后台自动跑 —— 这类动作会下载/写入系统目录。
 * 没有官方安装通道的工具不会出现在这里，面板只给 doctor 自带的 remediation 文本。
 */

import { useCallback, useRef, useState } from "react";
import type { PluginCommandRunResult } from "@astravia-org/plugin-sdk";

const INSTALL_TIMEOUT_MS = 10 * 60_000;

export type InstallTone = "success" | "danger";

export interface ToolInstallDeps {
	readonly run: (args: readonly string[], options: { cwd?: string; timeoutMs: number }) => Promise<PluginCommandRunResult>;
	readonly cwd: string | null;
	/** 安装结束（无论成败）后复检 doctor。 */
	readonly onFinished: () => void;
}

export interface ToolInstall {
	readonly installing: boolean;
	readonly message: string | null;
	readonly tone: InstallTone | null;
	install(args: readonly string[]): void;
}

export function useToolInstall(deps: ToolInstallDeps): ToolInstall {
	const depsRef = useRef(deps);
	depsRef.current = deps;
	const [installing, setInstalling] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [tone, setTone] = useState<InstallTone | null>(null);
	const busy = useRef(false);

	const install = useCallback((args: readonly string[]): void => {
		if (busy.current) return;
		busy.current = true;
		setInstalling(true);
		setMessage(null);
		setTone(null);

		void (async () => {
			try {
				const result = await depsRef.current.run(args, {
					...(depsRef.current.cwd ? { cwd: depsRef.current.cwd } : {}),
					timeoutMs: INSTALL_TIMEOUT_MS,
				});
				if (result.exitCode === 0) {
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
				setInstalling(false);
				depsRef.current.onFinished();
			}
		})();
	}, []);

	return { installing, message, tone, install };
}
