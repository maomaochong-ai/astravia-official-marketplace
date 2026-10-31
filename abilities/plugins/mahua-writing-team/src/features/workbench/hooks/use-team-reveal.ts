import { useCallback } from "react";
import { getStudioRuntime } from "../../../plugin-context.js";
import { useTranslator } from "./use-translator.js";

/**
 * 把光标送进对话输入区的最后一段路。
 *
 * 宿主 SDK（0.3.11）没有「聚焦会话 / 定位到侧栏对话」的 API：`conversation` 只有
 * `sendPrompt` / `createSession` / `insertText` / `abort`。而 `insertText("")` 不是聚焦——
 * 它写的是宿主的输入条 atom，等于**清空**用户刚打的草稿，所以这里不用它。
 *
 * 剩下唯一诚实做法是把焦点交给那条已经渲染出来的输入区：它只改变视线落点，
 * 不改任何内容。拿不到（宿主换了编辑器实现）就返回 false，由调用方退化成一句提示。
 */
function focusConversationComposer(): boolean {
	try {
		const editable = Array.from(document.querySelectorAll<HTMLElement>('[contenteditable="true"]')).filter(
			(node) => node.offsetParent !== null,
		);
		// 输入条在会话列的最下方，DOM 里排在消息之后；没有候选就是没有会话界面可跳。
		const target = editable.at(-1);
		if (!target) return false;
		target.focus({ preventScroll: true });
		return document.activeElement === target;
	} catch {
		return false;
	}
}

/**
 * 「跳到侧栏对话」——设计稿里唯一通往团队的门。
 *
 * 只做两件事，都不越界：先离开全屏覆盖层（否则对话被盖住，跳了也看不见），
 * 再把光标送进输入区。刻意不调 `sendPrompt`：设计与 ADR 都写明「只把视线送过去、
 * 不携带指令」，替用户发出一句话就等于工作台开始派活，那是第一条边界禁止的。
 */
export function useTeamReveal(onLeave?: () => void): () => void {
	const { ctx } = getStudioRuntime();
	const t = useTranslator();

	return useCallback(() => {
		onLeave?.();
		if (!focusConversationComposer()) ctx.ui.notify({ message: t("team.hint") });
	}, [ctx, onLeave, t]);
}
