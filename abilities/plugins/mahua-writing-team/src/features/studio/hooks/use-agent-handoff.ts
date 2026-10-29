import { useActiveConversation } from "@astravia-org/plugin-sdk";
import { useCallback, useState } from "react";
import type { NovelBook } from "../../../domain/novel-types.js";
import { routeNovel } from "../../../domain/novel-flow.js";
import { getStudioRuntime } from "../../../plugin-context.js";
import type { StudioMember } from "../../../studio-members.js";
import { invitePrompt, newBookPrompt, nextStepPrompt } from "../handoff-prompts.js";

export interface AgentHandoff {
	/** 宿主是否已经有一个活动会话：决定这一下是"接着聊"还是"新开一个"。 */
	connected: boolean;
	busy: boolean;
	/** 按路由结果开工（工作台的 [继续]）。 */
	start(): Promise<boolean>;
	/** 把某位成员叫上场：同一条通道，话术换成他的职责（ADR 0011 §2.2）。 */
	invite(member: StudioMember): Promise<boolean>;
	/** 还没有书时只做一件事：开书。 */
	proposeBook(): Promise<boolean>;
}

/**
 * 对话桥（ADR 0008）：把工作台的"下一步"交给宿主的智能体会话。
 *
 * 插件不自己造聊天界面——宿主的对话就是智能体界面。这里只负责两件事：
 * 1. 有活动会话就 `sendPrompt` 接着聊；没有就按工作区根建一个会话再发；
 * 2. 把路由结果翻译成一句人能看懂的开工话术（文案全部来自 catalog）。
 *
 * `use-agent-handoff` 是插件里**唯一**的 `ctx.conversation` 调用点，守卫测试钉着这一条。
 */
export function useAgentHandoff(book: NovelBook | null): AgentHandoff {
	const runtime = getStudioRuntime();
	const conversation = useActiveConversation();
	const [busy, setBusy] = useState(false);

	const dispatch = useCallback(
		async (compose: () => string): Promise<boolean> => {
			const ctx = runtime.ctx;
			const prompt = compose();
			if (!prompt) return false;

			setBusy(true);
			try {
				if (!conversation.id) {
					const root = ctx.fileExplorer.getWorkspaceRoots()[0]?.path;
					if (!root) {
						ctx.ui.notify({ message: ctx.i18n.t("studio.handoffNoWorkspace"), error: true });
						return false;
					}
					await ctx.conversation.createSession(root);
				}
				const receipt = await ctx.conversation.sendPrompt(prompt);
				if (receipt.status === "failed") {
					ctx.ui.notify({
						message: receipt.error?.message ?? ctx.i18n.t("studio.handoffFailed"),
						error: true,
					});
					return false;
				}
				ctx.ui.notify({ message: ctx.i18n.t("studio.handoffSent") });
				return true;
			} catch (cause) {
				ctx.ui.notify({
					message: cause instanceof Error ? cause.message : ctx.i18n.t("studio.handoffFailed"),
					error: true,
				});
				return false;
			} finally {
				setBusy(false);
			}
		},
		[conversation.id, runtime.ctx],
	);

	const start = useCallback(
		() => dispatch(() => (book ? nextStepPrompt(runtime.ctx.i18n.t, book, routeNovel(book)) : "")),
		[book, dispatch, runtime.ctx.i18n],
	);

	const invite = useCallback(
		(member: StudioMember) => dispatch(() => invitePrompt(runtime.ctx.i18n.t, member, book)),
		[book, dispatch, runtime.ctx.i18n],
	);

	const proposeBook = useCallback(
		() => dispatch(() => newBookPrompt(runtime.ctx.i18n.t)),
		[dispatch, runtime.ctx.i18n],
	);

	return {
		connected: conversation.id !== null,
		busy: busy || conversation.isStreaming,
		start,
		invite,
		proposeBook,
	};
}
