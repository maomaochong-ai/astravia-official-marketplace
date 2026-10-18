/**
 * 一键安装：只有「装完立刻能被 REA 用到」的工具才给按钮。
 *
 * 走 spawn 而不是 run：`brew install` 会跑几分钟，run 既看不到过程也没法中止。
 * spawn 给的是 `recentOutput`（宿主侧约 64KB 环形缓冲，合并 stdout+stderr）与
 * `stop()`（SIGTERM 整棵进程树，宽限期后 SIGKILL）。SDK 没有流式回调，
 * 所以过程靠轮询 `status()` 呈现，完成靠 `onExit` 判定——两者都不猜结果。
 *
 * 配方可以有多步（pip 类工具要先装 pipx，再 `pipx install X`）：按顺序跑，任一步非 0
 * 就停在原地，进度按「第 i/n 步」呈现——这是能观测的事实；具体一步内部只显示阶段
 * （下载 / 安装 / 收尾）与已用时间，不编造百分比，因为 brew 不报总进度。
 *
 * 只由用户点击触发，永远不在后台自动装。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginCommandSpawnExit, PluginCommandSpawnHandle } from "@astravia-org/plugin-sdk";
import {
	deriveInstallStage,
	describeRecipe,
	explainInstallError,
	firstChannel,
	installRecipeFor,
	installSteps,
	isRunnable,
	type InstallFailure,
	type InstallRunner,
	type InstallStage,
} from "../live/tool-install";

/** 轮询间隔：既要让日志看起来是「活的」，又不能把 IPC 打满。 */
const POLL_MS = 700;
/** 只在 UI 里留最后这么点日志，完整输出仍在宿主侧。 */
const LOG_TAIL_CHARS = 6_000;

export type InstallTone = "success" | "danger";

export type InstallPhase = "running" | "success" | "failed" | "cancelled";

export interface InstallProgress {
	readonly toolId: string;
	/** 整份计划的人类可读命令，例如 `brew install pipx && pipx install frida-tools`。 */
	readonly command: string;
	/** 当前这一步的命令，例如 `pipx install frida-tools`。 */
	readonly stepCommand: string;
	/** 当前这一步的序号（0 起）与总步数。 */
	readonly stepIndex: number;
	readonly stepCount: number;
	readonly phase: InstallPhase;
	readonly stage: InstallStage;
	readonly log: string;
	readonly startedAt: number;
	readonly endedAt: number | null;
	readonly exitCode: number | null;
	/** 翻译好的失败原因（key + 宿主原文）；成功 / 进行中为 null。 */
	readonly failure: InstallFailure | null;
	/** 已经点了取消、还在等进程退出。 */
	readonly cancelling: boolean;
}

export interface ToolInstallDeps {
	/** `npx -y rea-agents@latest <args>` 的长驻进程（REA 官方安装通道）。 */
	readonly spawnRea:
		| ((args: readonly string[], options: { cwd?: string }) => Promise<PluginCommandSpawnHandle>)
		| null;
	/** 直接 spawn 外部命令（brew / pipx）；null 表示没有 `agent.command.spawn` 授权。 */
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

function runnerText(runner: InstallRunner): string {
	const args = runner.args.join(" ");
	if (runner.channel === "rea") return `rea ${args}`;
	return `${runner.file ?? ""} ${args}`.trim();
}

export function useToolInstall(deps: ToolInstallDeps): ToolInstall {
	const depsRef = useRef(deps);
	const [progress, setProgress] = useState<InstallProgress | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [tone, setTone] = useState<InstallTone | null>(null);
	const handleRef = useRef<PluginCommandSpawnHandle | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const cancelledRef = useRef(false);
	/** 最后一步的完整输出：全部成功时用它收尾，避免读到过期的 state。 */
	const logRef = useRef("");
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
		return firstChannel(recipe) === "rea" ? depsRef.current.spawnRea !== null : depsRef.current.spawnCommand !== null;
	}, []);

	const install = useCallback((id: string): void => {
		const recipe = installRecipeFor(id);
		if (!isRunnable(recipe) || busy.current) return;
		const current = depsRef.current;
		const steps = installSteps(recipe);
		const channel = firstChannel(recipe);
		if (channel === null) return;
		if (channel === "rea" ? current.spawnRea === null : current.spawnCommand === null) {
			setTone("danger");
			setMessage("no spawn channel");
			return;
		}

		busy.current = true;
		cancelledRef.current = false;
		logRef.current = "";
		const startedAt = Date.now();
		setTone(null);
		setMessage(null);
		const first = steps[0] as InstallRunner;
		const patch = (changes: Partial<InstallProgress>): void => {
			setProgress((prev) => (prev === null ? prev : { ...prev, ...changes }));
		};
		setProgress({
			toolId: id,
			command: describeRecipe(recipe),
			stepCommand: runnerText(first),
			stepIndex: 0,
			stepCount: steps.length,
			phase: "running",
			stage: "starting",
			log: "",
			startedAt,
			endedAt: null,
			exitCode: null,
			failure: null,
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
						const log = tail(status.recentOutput);
						logRef.current = log;
						setProgress((prev) => (prev === null ? prev : { ...prev, log, stage: deriveInstallStage(log) }));
					})
					.catch(() => {
						/* 取不到过程不影响结论：退出与否只看 onExit。 */
					});
			}, POLL_MS);
		};

		const settle = (phase: InstallPhase, exitCode: number | null, log: string, failure: InstallFailure | null): void => {
			stopPolling();
			handleRef.current = null;
			busy.current = false;
			if (mountedRef.current) {
				setProgress((prev) =>
					prev === null
						? prev
						: {
								...prev,
								log,
								stage: deriveInstallStage(log),
								phase,
								endedAt: Date.now(),
								exitCode,
								failure,
								cancelling: false,
							},
				);
				setTone(phase === "success" ? "success" : "danger");
				setMessage(failure === null ? null : failure.detail);
				depsRef.current.onFinished();
			}
		};

		void (async () => {
			for (let index = 0; index < steps.length; index += 1) {
				const runner = steps[index] as InstallRunner;
				if (cancelledRef.current) {
					settle("cancelled", null, "", null);
					return;
				}
				patch({ stepIndex: index, stepCommand: runnerText(runner), stage: "starting", log: "" });

				let handle: PluginCommandSpawnHandle;
				try {
					handle =
						runner.channel === "rea"
							? await current.spawnRea!(runner.args, current.cwd ? { cwd: current.cwd } : {})
							: await current.spawnCommand!(runner.file ?? "brew", [...runner.args]);
				} catch (error) {
					const reason = error instanceof Error ? error.message : String(error);
					settle("failed", null, "", explainInstallError(reason));
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
				stopPolling();
				handleRef.current = null;
				const log = tail(status?.recentOutput ?? "");
				logRef.current = log;
				const exitCode = exit.exitCode ?? null;

				if (cancelledRef.current) {
					settle("cancelled", exitCode, log, null);
					return;
				}
				if (exitCode !== 0) {
					settle("failed", exitCode, log, explainInstallError(`${log}\nexit ${exit.exitCode ?? exit.signal ?? "?"}`));
					return;
				}
			}
			settle("success", 0, logRef.current, null);
		})();
	}, []);

	const cancel = useCallback((): void => {
		cancelledRef.current = true;
		setProgress((prev) => (prev === null ? prev : { ...prev, cancelling: true }));
		const handle = handleRef.current;
		if (handle === null) return;
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
