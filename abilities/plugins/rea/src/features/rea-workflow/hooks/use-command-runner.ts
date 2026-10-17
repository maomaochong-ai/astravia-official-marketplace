/**
 * 命令运行器：把 `cmd.cliProviders.run` 包装成一个可渲染的状态机。
 *
 * 状态只有一份「最近一次运行」，因为工作台的用途是「跑一下、看结果、据此决定下一步」，
 * 而不是历史记录面板；会话级的真实调用日志由 ReaLiveCallLog 负责。
 *
 * 依赖通过 ref 读取，避免每次渲染重建 identity 让调用点闭包过期。
 */

import { useRef, useState } from "react";
import type { PluginCommandRunResult } from "@astravia-org/plugin-sdk";
import { formatCommandLine, resolveCommandArgs, type ReaCommandDefinition } from "../data/commands";

export type CommandRunPhase = "running" | "done" | "failed";

export interface CommandRunState {
	readonly commandId: string;
	readonly label: string;
	readonly commandLine: string;
	readonly phase: CommandRunPhase;
	readonly exitCode: number | null;
	readonly durationMs: number;
	readonly stdout: string;
	readonly stderr: string;
	/** 宿主拒绝、超时或参数校验失败时的人话说明；正常退出为 null。 */
	readonly message: string | null;
}

export interface CommandRunnerDeps {
	run(args: readonly string[], options: { cwd?: string; timeoutMs: number }): Promise<PluginCommandRunResult>;
	/** 项目/会话工作目录；为空表示交给宿主默认目录。 */
	cwd: string | null;
	labelOf(command: ReaCommandDefinition): string;
	/** 需要目标但输入为空时的提示文案。 */
	targetRequiredMessage: string;
}

export interface CommandRunner {
	readonly state: CommandRunState | null;
	readonly busy: boolean;
	runCommand(command: ReaCommandDefinition, target: string): void;
	clear(): void;
}

export function useCommandRunner(deps: CommandRunnerDeps): CommandRunner {
	const depsRef = useRef(deps);
	depsRef.current = deps;
	const [state, setState] = useState<CommandRunState | null>(null);
	const busyRef = useRef(false);

	const runCommand = (command: ReaCommandDefinition, target: string): void => {
		if (busyRef.current) return;
		const current = depsRef.current;
		const trimmed = target.trim();
		const base = {
			commandId: command.id,
			label: current.labelOf(command),
			commandLine: formatCommandLine(command, trimmed),
		};

		if (command.needsTarget && trimmed.length === 0) {
			setState({
				...base,
				phase: "failed",
				exitCode: null,
				durationMs: 0,
				stdout: "",
				stderr: "",
				message: current.targetRequiredMessage,
			});
			return;
		}

		const startedAt = Date.now();
		busyRef.current = true;
		setState({ ...base, phase: "running", exitCode: null, durationMs: 0, stdout: "", stderr: "", message: null });

		void (async () => {
			try {
				const result = await current.run(resolveCommandArgs(command, trimmed), {
					...(current.cwd ? { cwd: current.cwd } : {}),
					timeoutMs: command.timeoutMs,
				});
				const ok = result.exitCode === 0;
				setState({
					...base,
					phase: ok ? "done" : "failed",
					exitCode: result.exitCode,
					durationMs: Date.now() - startedAt,
					stdout: result.stdout,
					stderr: result.stderr,
					message: null,
				});
			} catch (error) {
				setState({
					...base,
					phase: "failed",
					exitCode: null,
					durationMs: Date.now() - startedAt,
					stdout: "",
					stderr: "",
					message: error instanceof Error ? error.message : String(error),
				});
			} finally {
				busyRef.current = false;
			}
		})();
	};

	return {
		state,
		busy: state?.phase === "running",
		runCommand,
		clear: () => setState(null),
	};
}
