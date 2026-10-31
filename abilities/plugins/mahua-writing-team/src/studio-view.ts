import { createElement, type ComponentType } from "react";
import { STUDIO_VIEW_ID } from "./studio-ids.js";
import { WorkbenchSurface } from "./features/workbench/components/WorkbenchSurface.js";
import type { PluginContext } from "@astravia-org/plugin-sdk";

/**
 * 工作区的「整页」形态：注册成宿主的 workspace view，让工作台占据主内容区。
 *
 * 这不是覆盖层。宿主把视图当成一个真实页面（`plugin-workspace/<pluginId>/<viewId>`），
 * 侧栏、标题栏、聊天区都还在，排版由宿主负责——插件不必也不该自己 `fixed inset-0`，
 * 那会盖住宿主的 chrome，面板一换宽度就撑坏。
 *
 * `sidebar: false`：不在宿主的侧栏列表里单独出一行。用户从工作台面板里按「放大」进来，
 * 从这里按「收回对话面板」回去，两边都是显式按钮，没有第二条入口需要维护。
 *
 * 组件用 `createElement` 而不是 JSX，好让这个文件保持 `.ts`——`.tsx` 必须待在
 * feature/shared 的 `components/` 目录下（打包与代码组织两侧的约定）。
 */
export function registerStudioView(ctx: PluginContext) {
	const component: ComponentType = () => createElement(WorkbenchSurface, { surface: "page" });

	return ctx.ui.registerWorkspaceView({
		id: STUDIO_VIEW_ID,
		label: "%view.studio.label%",
		icon: "icon-[solar--book-2-linear]",
		sidebar: false,
		component,
	});
}
