import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createElement } from "react";
import { InstructionToolRow } from "./features/studio/components/InstructionToolRow.js";
import { NextStepContextCard } from "./features/studio/components/NextStepContextCard.js";
import { StatusToolRow } from "./features/studio/components/StatusToolRow.js";
import { STUDIO_MEMBERS, STUDIO_TEAM_ID } from "./studio-members.js";

/**
 * 对话侧的两块界面（ADR 0011 §2.1）：工具调用的行内渲染 + 新会话页的上下文区。
 *
 * 它们与侧栏工作台是**同一套语法**的两个落点：工作台显示"下一步"，这里显示"模型刚刚问到的
 * 下一步"。数据都来自工具返回值或同一个 `routeNovel`，不会各说一套。
 *
 * 用 `createElement` 而不是 JSX：这一层是装配代码，不是界面组件——插件规范要求所有 UI
 * `.tsx` 落在 `components/` 下，装配入口保持无 JSX。
 */
export function registerStudioSurfaces(ctx: PluginContext): Disposable {
	const rows = [
		ctx.ui.registerToolCallSlot({
			id: "mahua-next-instruction-row",
			toolName: "mahua_next_instruction",
			component: InstructionToolRow,
		}),
		ctx.ui.registerToolCallSlot({
			id: "mahua-book-status-row",
			toolName: "mahua_book_status",
			component: StatusToolRow,
		}),
	];

	const composer = ctx.ui.registerNewSessionContext({
		id: "mahua-next-step",
		label: "%composer.label%",
		// 只在本插件自己的智能体/团队被选中时上屏：`activateWhen` 写的是 manifest 里的 id。
		activateWhen: {
			agents: STUDIO_MEMBERS.map((member) => member.agentId),
			teams: [STUDIO_TEAM_ID],
		},
		width: "input",
		render: (context) =>
			createElement(NextStepContextCard, {
				insert: (text: string) => context.composer.insertText(text),
			}),
	});

	return {
		dispose() {
			composer.dispose();
			for (const row of rows) row.dispose();
		},
	};
}
