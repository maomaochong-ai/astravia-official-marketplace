/**
 * 一键安装：只有「装完立刻能被 REA 用到」的工具才给按钮。
 *
 * 走 spawn 而不是 run：`brew install` 会跑几分钟，run 既看不到过程也没法中止。
 * spawn 给的是 `recentOutput`（宿主侧约 64KB 环形缓冲，合并 stdout+stderr）与
 * `stop()`（SIGTERM 整棵进程树，宽限期后 SIGKILL）。SDK 没有流式回调，
 * 所以过程靠轮询 `status()` 呈现，完成靠 `onExit` 判定——两者都不猜结果。
 *
 * 只由用户点击触发，永远不在后台自动装。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginCommandSpawnExit, PluginCommandSpawnHandle } from "@astravia-org/plugin-sdk";
import { describeRecipe, installRecipeFor, isRunnable } from "../live/tool-install";

/** 轮询间隔：既要让日志看起来是「活的」，又不能把 IPC 打满。 */
const POLL_MS = 700;
/** 只在 UI 里留最后这么点日志，完整输出仍在宿主侧。 */
const LOG_TAIL_CHARS = 6_000;

export type InstallTone = "success" | "danger";

export type InstallPhase = "running" | "success" | "failed" | "cancelled";

export interface InstallProgress {
	readonly toolId: string;
	/** 人类可读的一行命令，例如 `brew install jadx`。 */
	readonly command: string;
	readonly phase: InstallPhase;
	readonly log: string;
	readonly startedAt: number;
	readonly endedAt: number | null;
	readonly exitCode: number | null;
	readonly message: string | null;
	/** 已经点了取消、还在等进程退出。 */
	readonly cancelling: boolean;
}

export interface ToolInstallDeps {
	/** `npx -y rea-agents@latest <args>` 的长驻进程（REA 官方安装通道）。 */
	readonly spawnRea:
		| ((args: readonly string[], options: { cwd?: string }) => Promise<PluginCommandSpawnHandle>)
		| null;
	/** 直接 spawn 外部命令（brew / pip3）；null 表示没有 `agent.command.spawn` 授权。 */
	readonly spawnCommand:
		| ((file: string, args: readonly string[]) => Promise<PluginCommandSpawnHandle>)
		| null;
	readonly cwd: string | null;
	/** 安装结束（无论成败）后重新探测 + 复检 doctor。 */
	readonly onFinished: () => void;
}

export interface ToolInstall {
	/** 正在跑安装的工具 id（点取消后仍算运行中，直到进程真的退出）。 */
	readonly installingId: string | null;
	readonly progress: InstallProgress | null;
	readonly message: string | null;
	readonly tone: InstallTone | null;
	canInstall(id: string): boolean;
	install(id: string): void;
	cancel(): void;
	dismiss(): void;
}

function tail(text: string): string {
	return text.length > LOG_TAIL_CHARS ? text.slice(text.length - LOG_TAIL_CHARS) : text;
}

/** 失败时给一句能定位问题的话：最后一行非空输出，没有就报退出码。 */
function failureText(log: string, exit: PluginCommandSpawnExit): string {
	const lastLine = log
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.pop();
	if (lastLine) return lastLine.slice(0, 240);
	return `exit ${exit.exitCode ?? exit.signal ?? "?"}`;
}

export function useToolInstall(deps: ToolInstallDeps): ToolInstall {
	const depsRef = useRef(deps);
	const [progress, setProgress] = useState<InstallProgress | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [tone, setTone] = useState<InstallTone | null>(null);
	const handleRef = useRef<PluginCommandSpawnHandle | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const cancelledRef = useRef(false);
	const mountedRef = useRef(true);
	const busy = useRef(false);

	function stopPolling(): void {
		if (timerRef.current === null) return;
		clearInterval(timerRef.current);
		timerRef.current = null;
	}

	// 回调存进 ref：安装过程是长任务，读到的必须是最新通道而不是首次渲染时的闭包。
	useEffect(() => {
		depsRef.current = deps;
	});

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			stopPolling();
			// 不在这里 stop 进程：插件卸载 / tab 关闭由宿主按进程组统一回收。
		};
	}, []);

	const canInstall = useCallback((id: string): boolean => {
		const recipe = installRecipeFor(id);
		if (!isRunnable(recipe)) return false;
		return recipe.runner?.channel === "rea" ? depsRef.current.spawnRea !== null : depsRef.current.spawnCommand !== null;
	}, []);

	const install = useCallback((id: string): void => {
		const recipe = installRecipeFor(id);
		if (!isRunnable(recipe) || busy.current) return;
		const current = depsRef.current;
		const runner = recipe.runner;
		if (runner === null) return;
		if (runner.channel === "rea" ? current.spawnRea === null : current.spawnCommand === null) {
			setTone("danger");
			setMessage("no spawn channel");
			return;
		}

		busy.current = true;
		cancelledRef.current = false;
		const startedAt = Date.now();
		setTone(null);
		setMessage(null);
		setProgress({
			toolId: id,
			command: describeRecipe(recipe),
			phase: "running",
			log: "",
			startedAt,
			endedAt: null,
			exitCode: null,
			message: null,
			cancelling: false,
		});

		const poll = (handle: PluginCommandSpawnHandle): void => {
			stopPolling();
			timerRef.current = setInterval(() => {
				void handle
					.status()
					.then((status) => {
						// 即使日志没变也要重新渲染：上面那行「已用 Ns」靠这次更新跳动。
						if (!mountedRef.current) return;
						setProgress((prev) => (prev === null ? prev : { ...prev, log: tail(status.recentOutput) }));
					})
					.catch(() => {
						/* 取不到过程不影响结论：退出与否只看 onExit。 */
					});
			}, POLL_MS);
		};

		const settle = (handle: PluginCommandSpawnHandle, exit: PluginCommandSpawnExit, log: string): void => {
			stopPolling();
			handleRef.current = null;
			busy.current = false;
			const exitCode = exit.exitCode ?? null;
			const phase: InstallPhase = cancelledRef.current ? "cancelled" : exitCode === 0 ? "success" : "failed";
			const failure = phase === "failed" ? failureText(log, exit) : null;
			if (mountedRef.current) {
				setProgress((prev) =>
					prev === null
						? prev
						: { ...prev, log, phase, endedAt: Date.now(), exitCode, message: failure, cancelling: false },
				);
				setTone(phase === "success" ? "success" : "danger");
				setMessage(failure);
			}
			if (mountedRef.current) depsRef.current.onFinished();
		};

		void (async () => {
			let handle: PluginCommandSpawnHandle;
			try {
				handle =
					runner.channel === "rea"
						? await current.spawnRea!(runner.args, current.cwd ? { cwd: current.cwd } : {})
						: await current.spawnCommand!(runner.file ?? "brew", [...runner.args]);
			} catch (error) {
				busy.current = false;
				const reason = error instanceof Error ? error.message : String(error);
				if (mountedRef.current) {
					setProgress((prev) =>
						prev === null
							? prev
							: { ...prev, phase: "failed", endedAt: Date.now(), message: reason, cancelling: false },
					);
					setTone("danger");
					setMessage(reason);
				}
				depsRef.current.onFinished();
				return;
			}

			if (!mountedRef.current) {
				// 用户已经离开面板：不留下无人看管的安装进程。
				void handle.stop().catch(() => undefined);
				busy.current = false;
				return;
			}

			handleRef.current = handle;
			poll(handle);
			const exit = await new Promise<PluginCommandSpawnExit>((resolve) => {
				const disposable = handle.onExit((value) => {
					disposable.dispose();
					resolve(value);
				});
			});
			// 退出后再取一次 status：这时 recentOutput 才是完整输出。
			const status = await handle.status().catch(() => null);
			settle(handle, exit, tail(status?.recentOutput ?? ""));
		})();
	}, []);

	const cancel = useCallback((): void => {
		const handle = handleRef.current;
		if (handle === null) return;
		cancelledRef.current = true;
		setProgress((prev) => (prev === null ? prev : { ...prev, cancelling: true }));
		void handle.stop().catch(() => undefined);
	}, []);

	const dismiss = useCallback((): void => {
		if (busy.current) return;
		setProgress(null);
		setTone(null);
		setMessage(null);
	}, []);

	const installingId = progress !== null && progress.phase === "running" ? progress.toolId : null;

	return { installingId, progress, message, tone, canInstall, install, cancel, dismiss };
}
