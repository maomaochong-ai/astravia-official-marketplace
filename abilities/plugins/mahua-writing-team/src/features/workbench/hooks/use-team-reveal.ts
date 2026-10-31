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
 * 剩下唯一诚实做法是把焦点交给那条已经渲染出来的输入区：它只改变视线落点，不改内容。
 * 定位分两步：先找最后一块可见的 `.input-card`（宿主输入条的稳定外壳，`data-focused`
 * 也挂在它上面），再取它内部的 `[contenteditable="true"]`。直接用全页的 contenteditable
 * 会撞上别的编辑器——文件预览里的 CodeMirror 区同样是可编辑的，落在那里等于跳错地方。
 * 拿不到输入条（宿主换了实现）才退回旧的全页启发式；两条都不成就返回 false，
 * 由调用方退化成一句提示。
 */
function lastVisible<T extends HTMLElement>(nodes: NodeListOf<T>): T | null {
	const visible = Array.from(nodes).filter((node) => node.offsetParent !== null);
	return visible.at(-1) ?? null;
}

function focusConversationComposer(): boolean {
	try {
		const card = lastVisible(document.querySelectorAll<HTMLElement>(".input-card"));
		const target = card
			? card.querySelector<HTMLElement>('[contenteditable="true"]')
			: lastVisible(document.querySelectorAll<HTMLElement>('[contenteditable="true"]'));
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
 * 只做一件事：把光标送进输入区，让用户的视线落到团队身上。刻意不发任何调用——
 * 不 `sendPrompt`、不 `insertText`、不 `createSession`。设计与 ADR 都写明「只把视线
 * 送过去、不携带指令」，替用户发出一句话就等于工作台开始派活，那是第一条边界禁止的。
 *
 * 工作台现在没有覆盖层了（整页形态是宿主的工作区视图，侧栏本来就在），所以这里
 * 不再需要「先退出全屏」这一步。
 */
export function useTeamReveal(): () => void {
	const { ctx } = getStudioRuntime();
	const t = useTranslator();

	return useCallback(() => {
		if (!focusConversationComposer()) ctx.ui.notify({ message: t("team.hint") });
	}, [ctx, t]);
}
