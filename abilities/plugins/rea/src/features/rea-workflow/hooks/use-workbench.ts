/**
 * 工作台状态：目标类型 + 目标路径 + 交给 Agent 的回执。
 *
 * 「交给 Agent」做的是真的发送（`conversation.sendPrompt`），不是只往输入框塞文本：
 * 塞文本会让用户看不到任何变化（草稿区在别的窗口/别的滚动位置），这是最容易被当成
 * "按钮没反应"的失败方式。发送结果按宿主回执如实区分 sent / queued；
 * 发送不可用时退回「仅填入」，两者都失败才报失败，并保留任务文本供复制。
 *
 * 目标类型不再是「必须先选」的前置：用户消息、工具调用、输入框里的路径都能推出类型。
 * 推不出来时不再静默 return，而是给出可读的原因（见 `blockReason`）。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { SendPromptResult } from "@astravia-org/plugin-sdk";
import { getTarget, type TargetKind } from "../data/targets";
import { detectTargetFromMessage } from "../live/target-inference";

export type HandoffState = "idle" | "sending" | "sent" | "queued" | "inserted" | "failed";

/** 目标类型的来源，用于 UI 说明「为什么自动选中了这个」。 */
export type KindSource = "picked" | "detected" | "hinted" | "typed";

/** 为什么现在不能交给 Agent。 */
export type BlockReason = "empty" | "noKind" | "sending" | null;

export interface WorkbenchDeps {
	/** 真正把 prompt 发进当前会话。没有活跃会话时会抛错。 */
	readonly sendPrompt: (prompt: string) => Promise<SendPromptResult>;
	/** 只填入输入框、不发送；返回 false 表示当前会话不可写。 */
	readonly insertPrompt: (prompt: string) => boolean;
	readonly cwd: string | null;
	/** 会话里真实工具调用指向的目标类型。 */
	readonly detected: TargetKind | null;
	/** 会话里最近一次带路径的工具参数；仅在目标输入框为空时自动回填。 */
	readonly detectedPath: string | null;
	/** 用户消息里提到的目标类型。 */
	readonly hinted: TargetKind | null;
	/** 用户消息里提到的路径/URL。 */
	readonly hintedPath: string | null;
	/** 选定目标后跳到对应阶段（当前全部跳 route）。 */
	readonly onRoute: (stage: number) => void;
}

export interface Workbench {
	/** 生效目标：用户手动选择优先，其次会话识别，最后按输入框内容推断。 */
	readonly active: TargetKind | null;
	readonly kindSource: KindSource | null;
	readonly picked: boolean;
	readonly target: string;
	readonly handoff: HandoffState;
	/** 最近一次要交给 Agent 的完整任务文本；失败时可复制。 */
	readonly promptText: string;
	/** 不能提交时的原因；null 表示现在可以提交。 */
	readonly blockReason: BlockReason;
	pick(kind: TargetKind): void;
	clearPick(): void;
	setTarget(value: string): void;
	/** 发送到对话；给了 targetOverride 时用它替代当前输入框内容。 */
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
	const discoveredPath = deps.detectedPath ?? deps.hintedPath;
	useEffect(() => {
		if (!discoveredPath || discoveredPath === autoFilled.current) return;
		autoFilled.current = discoveredPath;
		setTargetValue((current) => (current.trim().length === 0 ? discoveredPath : current));
	}, [discoveredPath]);

	/** 输入框内容能推断出的类型（用户直接打字/粘贴路径时最有用）。 */
	const typedKind = useMemo(() => {
		const trimmed = target.trim();
		return trimmed.length === 0 ? null : detectTargetFromMessage(trimmed);
	}, [target]);

/**
 * 优先看用户当下写下的字：输入框里的路径能被识别成类型时，它比会话里早先
 * 一次工具调用的结果更新。两边一致时不会感到差异，不一致时 UI 会用冲突提示
 * 告诉用户「会话识别到 X，你写的是 Y」。
 */
function resolveKind(
	picked: TargetKind | null,
	typed: TargetKind | null,
	detected: TargetKind | null,
	hinted: TargetKind | null,
): TargetKind | null {
	return picked ?? typed ?? detected ?? hinted;
}

const active = resolveKind(picked, typedKind, deps.detected, deps.hinted);
const kindSource: KindSource | null =
	picked !== null
		? "picked"
		: typedKind !== null
			? "typed"
			: deps.detected !== null
				? "detected"
				: deps.hinted !== null
					? "hinted"
					: null;

	const blockReason: BlockReason =
		handoff === "sending"
			? "sending"
			: target.trim().length === 0
				? "empty"
				: active === null
					? "noKind"
					: null;

	const buildPrompt = (targetOverride?: string): string | null => {
		const current = depsRef.current;
		const trimmed = (targetOverride ?? target).trim();
		if (trimmed.length === 0) return null;
		const kind = picked ?? detectTargetFromMessage(trimmed) ?? current.detected ?? current.hinted;
		if (kind === null) return null;
		const definition = getTarget(kind);
		return t("tab.workbench.handoffPrompt", {
			target: trimmed,
			kind: t(definition.labelKey),
			// 入口工具随目标类型变：JS 从 ASAR 下手、固件从 binwalk 下手，不是同一句话。
			entry: definition.entryTool,
			firstMove: t(definition.firstMoveKey),
		});
	};

	return {
		active,
		kindSource,
		picked: picked !== null,
		target,
		handoff,
		promptText,
		blockReason,
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
