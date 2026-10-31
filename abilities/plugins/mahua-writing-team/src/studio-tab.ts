import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createElement } from "react";
import { WorkbenchMount } from "./features/workbench/components/WorkbenchMount.js";
import { STUDIO_TAB_ID } from "./studio-ids.js";

export { STUDIO_TAB_ID };

/** 标签栏图标：iconify class 字符串，由插件自己的 CSS 生成（见 style.css）。 */
export const STUDIO_TAB_ICON = "icon-[solar--book-2-linear]";

/**
 * 工作台是**标签页**，不是侧边栏入口（ADR 0025 §2）。
 *
 * 标签默认就上栏（`initiallyVisible: true`）。ADR 0025 §2 原本写的是 `false`「入池不上栏」，
 * 把入口交给活动面板的「+ → 可添加插件面板」；宿主 0.5.65 读下来这条路对插件标签是条件化的，
 * 四个条件任一不成立就没有「+」，标签也就无从添加（见 ADR 0025 末尾补注）：
 *
 * 1. `useActivityPanelModel.ts` 的 `showTabPicker` 要求 `cwd !== null` 且「可恢复 / 收纳 /
 *    可添加」三类之一非空；三类全空时整枚按钮都不渲染，不是加号变下箭头。
 * 2. `useActivityTabDefinitions.tsx` 在 `pluginScenario === undefined` 时直接返回内置标签，
 *    而 `currentScenarioAtom` 在新建会话页与尚未加载时就是 `null`。
 * 3. `scope_use` 不含当前场景（fail-closed）。
 * 4. `enablePluginTabs={false}`：只读历史会话页走的是这条路。
 *
 * 上栏之后仍然 `removable: true`：用户点减号收起会留下一条显式 `false`，标签回到池子里，
 * 那时「+」反而一定会出现——加号只在「确实有东西可加」时才该出现。
 *
 * `scope_use` 是 fail-closed 的：不声明场景，标签在任何会话里都不会出现，所以这里写全
 * 本插件工具实际服务的两种场景（口径见 `src/scenarios.ts`）。
 *
 * 凭证判断不在这里做：未激活时视图自己渲染激活页（ADR 0024 §6），所以标签从装上那天起
 * 就在栏上，不会因为凭证过期而消失。
 */
export function registerStudioTab(ctx: PluginContext): Disposable {
	return ctx.ui.registerActivityTab({
		id: STUDIO_TAB_ID,
		label: "%view.studio.label%",
		icon: createElement("span", {
			className: `${STUDIO_TAB_ICON} h-4 w-4 shrink-0`,
			"aria-hidden": true,
		}),
		component: WorkbenchMount,
		scope_use: ["conversation", "project"],
		initiallyVisible: true,
		// 切到别的标签再切回来，路由（看到哪本书、读到哪一章）要还在。
		retention: "warm",
	});
}
