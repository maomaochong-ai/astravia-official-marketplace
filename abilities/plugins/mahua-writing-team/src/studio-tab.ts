import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { createElement } from "react";
import { StudioWorkspaceView } from "./features/studio/components/StudioWorkspaceView.js";

export const STUDIO_TAB_ID = "studio";

/** 标签栏图标：iconify class 字符串，由插件自己的 CSS 生成（见 style.css）。 */
export const STUDIO_TAB_ICON = "icon-[solar--book-2-linear]";

/**
 * 工作台是**标签页**，不是侧边栏入口（ADR 0025 §2）。
 *
 * 侧边栏是用户自己整理的稀缺导航位；一个写作工作台在里面常驻，等于把用户真正在用的入口
 * 挤进「更多」。活动面板的标签栏本来就有「+ → 可添加插件面板」这一层：插件先入池，用户
 * 需要时自己加，不需要时减号就收起。
 *
 * `initiallyVisible: false` 就是「入池，不上栏」——加不加由用户决定。
 * `scope_use` 是 fail-closed 的：不声明场景，标签在任何会话里都不会出现，所以这里写全
 * 本插件工具实际服务的两种场景（与 `novel-tools.ts` 的 `SCENARIOS` 同一口径）。
 *
 * 凭证判断不在这里做：未激活时视图自己渲染激活面板（同一块面板，ADR 0024 §6），
 * 所以标签从装上那天起就一直在池子里，不会因为凭证过期而消失。
 */
export function registerStudioTab(ctx: PluginContext): Disposable {
	return ctx.ui.registerActivityTab({
		id: STUDIO_TAB_ID,
		label: "%view.studio.label%",
		icon: createElement("span", {
			className: `${STUDIO_TAB_ICON} h-4 w-4 shrink-0`,
			"aria-hidden": true,
		}),
		component: StudioWorkspaceView,
		scope_use: ["conversation", "project"],
		initiallyVisible: false,
		// 切到别的标签再切回来，路由（看到哪本书、读到哪一章）要还在。
		retention: "warm",
	});
}
