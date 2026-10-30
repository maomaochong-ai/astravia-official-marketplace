import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { StudioWorkspaceView } from "./features/studio/components/StudioWorkspaceView.js";
import { STUDIO_TAB_ICON } from "./studio-tab.js";

/** 工作区视图 id：宿主会命名空间化成 `mahua-writing-team:mahua-studio`。 */
export const STUDIO_VIEW_ID = "mahua-studio";

/**
 * 工作区的第二个入口：宿主侧栏里的工作区视图（ADR 0025 末尾补注）。
 *
 * ADR 0025 §2 原本把工作台只做成一枚活动面板标签，理由是「侧边栏是用户的导航位」。
 * 实际用下来的结论是这条单入口不成立：
 *
 * 1. 面板标签默认就上栏，而宿主的 `isPluginTabOnBar` 判定里「在栏上」与「在 + 可添加池」
 *    互斥（`resolve-activity-tabs.ts`）。上栏意味着用户**永远**不会在「+ → 可添加面板」
 *    里看到它；用户反馈的「标签页菜单里没有麻花小说网」正是这个结构的结果。
 * 2. 用户点减号收起后标签才会回到池子，可没有人会为了找到面板先把它藏起来。
 *
 * 所以两个入口同时注册，并用顶栏按钮互相跳转：活动标签负责「贴着当前对话」，工作区视图
 * 负责「整页写作」。这也是 dbx-pro 的做法（`registerActivityTab` + `registerWorkspaceView`），
 * 不再另造机制。
 *
 * 注意这里的 `icon` 是 iconify class 字符串而不是 React 节点——工作区视图的图标由宿主画在
 * 自己的导航按钮里，它按 key 持久化导航布局，拿不了节点。活动标签相反（见 `studio-tab.ts`）。
 */
export function registerStudioWorkspaceView(ctx: PluginContext): Disposable {
	return ctx.ui.registerWorkspaceView({
		id: STUDIO_VIEW_ID,
		label: "%workspace.studio.label%",
		description: "%workspace.studio.description%",
		icon: STUDIO_TAB_ICON,
		component: StudioWorkspaceView,
		// 只注册这一个视图，留 0 即可；写成显式数字是为了以后加分页时有参照。
		navOrder: 0,
	});
}
