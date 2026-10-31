import { StudioTurnCard } from "./features/workbench/components/StudioTurnCard.js";
import type { PluginContext } from "@astravia-org/plugin-sdk";

/**
 * 对话里的落章卡片。
 *
 * 团队在侧栏写完一章，消息列表底部出现一张「本章已落盘」的卡片——它是这条同步链路上
 * 唯一从工作台走回对话的东西，而且只**报告**，不发起：点开只是看运行台的流水。
 *
 * `scope_use` 是 fail-closed 的：不写就哪儿都不显示，所以两个场景都显式列出。
 */
export function registerStudioTurnCard(ctx: PluginContext) {
	return ctx.ui.registerTurnCard({
		id: "landed",
		component: StudioTurnCard,
		scope_use: ["conversation", "project"],
	});
}
