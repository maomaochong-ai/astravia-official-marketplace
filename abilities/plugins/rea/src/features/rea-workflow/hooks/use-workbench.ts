/**
 * 工作台状态：目标类型选择 + 目标路径输入 + 命令运行器 + 「交给 Agent」回执。
 *
 * 放在 hook 里是因为 tab 顶部的工作台与下方的阶段详情要共享同一台运行器和同一个目标值
 * （阶段详情会把阶段声明的命令 id 渲染成可点击执行的行）。工作目录与 prompt 写入能力
 * 由装配层通过 deps 注入，组件本身不碰 ctx。
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { PluginCommandRunResult } from "@astravia-org/plugin-sdk";
import { commandsForTarget, type ReaCommandDefinition } from "../data/commands";
import { getTarget, type TargetKind } from "../data/targets";
import { useCommandRunner, type CommandRunner } from "./use-command-runner";

export type HandoffState = "idle" | "done" | "failed";

export interface WorkbenchDeps {
	readonly run: (args: readonly string[], options: { cwd?: string; timeoutMs: number }) => Promise<PluginCommandRunResult>;
	/** 把结构化任务写进输入框；返回 false 表示当前会话不可写（权限或状态不允许）。 */
	readonly insertPrompt: (prompt: string) => boolean;
	readonly cwd: string | null;
	readonly detected: TargetKind | null;
	/** 会话里最近一次带路径的工具参数；仅在目标输入框为空时自动回填。 */
	readonly detectedPath: string | null;
	/** 选定目标后跳到对应阶段（当前全部跳 route）。 */
	readonly onRoute: (stage: number) => void;
}

export interface Workbench {
	/** 生效目标：用户手动选择优先，其次会话检测。 */
	readonly active: TargetKind | null;
	readonly picked: boolean;
	readonly target: string;
	readonly commands: readonly ReaCommandDefinition[];
	readonly runner: CommandRunner;
	readonly handoff: HandoffState;
	pick(kind: TargetKind): void;
	clearPick(): void;
	setTarget(value: string): void;
	runCommand(command: ReaCommandDefinition): void;
	handoffToAgent(): void;
}

export function useWorkbench(deps: WorkbenchDeps): Workbench {
	const { t } = useTranslation();
	const [picked, setPicked] = useState<TargetKind | null>(null);
	const [target, setTargetValue] = useState<string>("");
	const [handoff, setHandoff] = useState<HandoffState>("idle");
	const autoFilled = useRef<string | null>(null);

	// 会话里刚发现的路径直接落到输入框：Agent 已经找到了目标，用户不必手抄一遍。
	// 只填空输入框，不覆盖用户已经写下的内容。
	useEffect(() => {
		const path = deps.detectedPath;
		if (!path || path === autoFilled.current) return;
		autoFilled.current = path;
		setTargetValue((current) => (current.trim().length === 0 ? path : current));
	}, [deps.detectedPath]);

	const active = picked ?? deps.detected ?? null;
	const runner = useCommandRunner({
		run: deps.run,
		cwd: deps.cwd,
		labelOf: (command) => t(command.labelKey),
		targetRequiredMessage: t("tab.workbench.targetRequired"),
	});

	return {
		active,
		picked: picked !== null,
		target,
		commands: commandsForTarget(active),
		runner,
		handoff,
		pick: (kind) => {
			setPicked(kind);
			setHandoff("idle");
			deps.onRoute(getTarget(kind).routeStage);
		},
		clearPick: () => {
			setPicked(null);
			setHandoff("idle");
		},
		setTarget: (value) => {
			setTargetValue(value);
			setHandoff("idle");
		},
		runCommand: (command) => runner.runCommand(command, target),
		handoffToAgent: () => {
			if (!active || target.trim().length === 0) return;
			const prompt = t("tab.workbench.handoffPrompt", {
				target: target.trim(),
				kind: t(getTarget(active).labelKey),
			});
			setHandoff(deps.insertPrompt(prompt) ? "done" : "failed");
		},
	};
}
