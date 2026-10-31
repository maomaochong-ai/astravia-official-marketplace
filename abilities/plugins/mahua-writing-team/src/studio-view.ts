import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { WorkbenchFullPage } from "./features/workbench/components/WorkbenchFullPage.js";
import { STUDIO_TAB_ID, STUDIO_VIEW_ID } from "./studio-ids.js";

/**
 * 整页：宿主唯一一块「没有会话侧栏、没有输入框」的画布。
 *
 * 面板最宽也还留着会话侧栏和输入框，而宿主没有给插件 `requestFullscreen`——
 * 「只看到工作台」只能走 workspace view。它是宿主的一级路由
 * （`/workspace/<pluginId>/<viewId>`），跨会话常驻，不是浮层也不是新窗口。
 *
 * 两条入口互为镜像：标签页右上角放大 → 整页；整页报头右上角收回 → 标签页。
 * 两边是同一张界面，只有宿主给的画布不同。
 */
export const STUDIO_VIEW_LABEL = "%view.studio.label%";

export function registerStudioView(ctx: PluginContext): Disposable {
	return ctx.ui.registerWorkspaceView({
		id: STUDIO_VIEW_ID,
		label: STUDIO_VIEW_LABEL,
		icon: "icon-[solar--book-2-bold]",
		component: WorkbenchFullPage,
		// 整页是「偶尔放大看一眼」的入口，不是第二个常驻导航项；
		// 侧栏位置留给用户自己挑，宿主会把这一页列在设置里，入口不会丢。
		sidebar: false,
		navOrder: 0,
	});
}

export function openStudioFullPage(ctx: PluginContext): void {
	ctx.ui.openWorkspaceView(STUDIO_VIEW_ID);
}

export function openStudioTab(ctx: PluginContext): void {
	ctx.ui.openActivityTab(STUDIO_TAB_ID);
}
