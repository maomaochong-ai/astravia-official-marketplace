import { useEffect } from "react";
import { boardmixStateFor, type BoardmixPanelState, type BoardmixPromptState } from "../../../domain/boardmix-attachment";

/**
 * 「用户此刻在说的是这块白板」这一件事的唯一真相源。
 *
 * 三个写入口都汇到这里：面板上报自己的状态、用户点输入栏开关、标签名变化。谁后写谁赢
 * 的话两边会互相把对方抹掉，所以这里只存状态，不下判断；判断在 `boardmixStateFor` 里。
 *
 * **不再调用 `setPromptAttachment`。** 那条通道会把胶囊画在输入框卡片下沿外面——那是宿主
 * 内置附件的位置，跨消息、跨会话都在。市场插件的可见入口是它自己那枚开关，状态随
 * `decoratePrompt()` 在发送时交付（见 hooks/input-action.ts），任何时刻输入框内外都不留痕。
 */

interface Store {
	engaged: boolean;
	panel: BoardmixPanelState;
	label: string;
}

const store: Store = { engaged: false, panel: { active: false, ready: false, landedUrl: null }, label: "" };

/** 发送那一刻求值一次：这一轮该不该带白板状态。 */
export function readBoardmixState(): { state: BoardmixPromptState; label: string } | null {
	const state = boardmixStateFor({ engaged: store.engaged, panel: store.panel });
	return state === null ? null : { state, label: store.label.trim() || "Boardmix" };
}

/** 用户点了输入栏上的白板开关。 */
export function setBoardmixEngaged(engaged: boolean): void {
	store.engaged = engaged;
}

/** 胶囊上的名字来自标签页标题；切语言时跟着变。 */
export function setBoardmixAttachmentLabel(label: string): void {
	store.label = label;
}

/** 面板上报自己的状态。组件卸载时传 null：面板没了，只要开关还开着就仍算在说。 */
export function setBoardmixPanel(panel: BoardmixPanelState | null): void {
	store.panel = panel ?? { active: false, ready: false, landedUrl: null };
}

/** 组件用的薄封装：状态变了就上报，卸载时退回「面板不在」。 */
export function usePromptAttachment(input: BoardmixPanelState & { label: string }): void {
	const { active, ready, landedUrl, label } = input;

	useEffect(() => {
		setBoardmixAttachmentLabel(label);
	}, [label]);

	useEffect(() => {
		setBoardmixPanel({ active, ready, landedUrl });
	}, [active, ready, landedUrl]);

	useEffect(() => () => setBoardmixPanel(null), []);
}
