/**
 * 工作台状态：目标类型 + 目标路径 + 交给 Agent 的回执。
 *
 * 「交给 Agent」现在做的是真的发送（`conversation.sendPrompt`），不是只往输入框塞文本：
 * 塞文本会让用户看不到任何变化（草稿区在别的窗口/别的滚动位置），这是最容易被当成
 * "按钮没反应"的失败方式。发送结果按宿主回执如实区分 sent / queued；
 * 发送不可用时退回「仅填入」，两者都失败才报失败，并保留任务文本供复制。
 *
 * 命令执行不再是工作台职责：手动跑 CLI 与 Agent 侧自动执行重叠且职责含糊，
 * 阶段详情只说明「Agent 会执行哪些工具」，不提供第二条执行途径。
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { SendPromptResult } from "@astravia-org/plugin-sdk";
import { getTarget, type TargetKind } from "../data/targets";

export type HandoffState = "idle" | "sending" | "sent" | "queued" | "inserted" | "failed";

export interface WorkbenchDeps {
	/** 真正把 prompt 发进当前会话。没有活跃会话时会抛错。 */
	readonly sendPrompt: (prompt: string) => Promise<SendPromptResult>;
	/** 只填入输入框、不发送；返回 false 表示当前会话不可写。 */
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
	readonly handoff: HandoffState;
	/** 最近一次要交给 Agent 的完整任务文本；失败时可复制。 */
	readonly promptText: string;
	pick(kind: TargetKind): void;
	clearPick(): void;
	setTarget(value: string): void;
	/** 发送到对话；给了 targetOverride 时用它替代当前输入框内容（用于会话发现路径的直接回填）。 */
	handoffToAgent(targetOverride?: string): void;
	/** 只填入宿主输入框、不发送。 */
	insertToChat(targetOverride?: string): void;
}

export function useWorkbench(deps: WorkbenchDeps): Workbench {
	const { t } = useTranslation();
	const depsRef = useRef(deps);
	depsRef.current = deps;
	const [picked, setPicked] = useState<TargetKind | null>(null);
	const [target, setTargetValue] = useState<string>("");
	const [handoff, setHandoff] = useState<HandoffState>("idle");
	const [promptText, setPromptText] = useState<string>("");
	const autoFilled = useRef<string | null>(null);
	const sending = useRef(false);

	// 会话里刚发现的路径直接落到输入框：Agent 已经找到了目标，用户不必手抄一遍。
	// 只填空输入框，不覆盖用户已经写下的内容。
	useEffect(() => {
		const path = deps.detectedPath;
		if (!path || path === autoFilled.current) return;
		autoFilled.current = path;
		setTargetValue((current) => (current.trim().length === 0 ? path : current));
	}, [deps.detectedPath]);

	const active = picked ?? deps.detected ?? null;

	const buildPrompt = (targetOverride?: string): string | null => {
		const current = depsRef.current;
		const kind = picked ?? current.detected ?? null;
		const trimmed = (targetOverride ?? target).trim();
		if (kind === null || trimmed.length === 0) return null;
		return t("tab.workbench.handoffPrompt", {
			target: trimmed,
			kind: t(getTarget(kind).labelKey),
		});
	};

	return {
		active,
		picked: picked !== null,
		target,
		handoff,
		promptText,
		pick: (kind) => {
			setPicked(kind);
			setHandoff("idle");
			depsRef.current.onRoute(getTarget(kind).routeStage);
		},
		clearPick: () => {
			setPicked(null);
			setHandoff("idle");
		},
		setTarget: (value) => {
			setTargetValue(value);
			setHandoff((prev) => (prev === "sending" ? prev : "idle"));
		},
		handoffToAgent: (targetOverride) => {
			if (sending.current) return;
			const prompt = buildPrompt(targetOverride);
			if (prompt === null) return;
			setPromptText(prompt);
			sending.current = true;
			setHandoff("sending");

			void (async () => {
				try {
					const result = await depsRef.current.sendPrompt(prompt);
					if (result.status === "sent" || result.status === "queued") {
						setHandoff(result.status);
						return;
					}
				} catch (error) {
					console.warn("[rea] sendPrompt failed, falling back to insertText", error);
				} finally {
					sending.current = false;
				}
				// 发送通道不可用（没有活跃会话 / 权限被拒）：退回只填入，仍让用户能一键发送。
				const inserted = depsRef.current.insertPrompt(prompt);
				setHandoff(inserted ? "inserted" : "failed");
			})();
		},
		insertToChat: (targetOverride) => {
			const prompt = buildPrompt(targetOverride);
			if (prompt === null) return;
			setPromptText(prompt);
			setHandoff(depsRef.current.insertPrompt(prompt) ? "inserted" : "failed");
		},
	};
}
