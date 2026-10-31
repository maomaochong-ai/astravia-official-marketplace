import { useCallback } from "react";
import { getStudioRuntime } from "../../../plugin-context.js";
import { useTranslator } from "./use-translator.js";

/**
 * 「跳到侧栏对话」——设计稿里唯一通往团队的门。
 *
 * 宿主 SDK（0.3.11）没有「聚焦侧栏对话 / 激活会话」的 API：`conversation` 只提供
 * `sendPrompt` / `createSession` / `insertText` / `abort`。所以这里只做两件不越界的事：
 *
 * 1. `insertText("")`——有活跃会话时把输入条点亮，用户接着自己说话；
 * 2. 报一句「团队在侧栏」——告诉人往哪看。
 *
 * 刻意不调 `sendPrompt`：设计与 ADR 都写明「只把视线送过去、不携带指令」，
 * 替用户发出一句话就等于工作台开始派活，那是第一条边界禁止的。
 */
export function useTeamReveal(): () => void {
	const { ctx } = getStudioRuntime();
	const t = useTranslator();

	return useCallback(() => {
		ctx.conversation.insertText("");
		ctx.ui.notify({ message: t("team.hint") });
	}, [ctx, t]);
}
