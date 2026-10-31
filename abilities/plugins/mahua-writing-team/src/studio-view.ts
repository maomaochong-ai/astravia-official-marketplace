import { createElement, type ComponentType } from "react";
import { STUDIO_VIEW_ID } from "./studio-ids.js";
import { WorkbenchMount } from "./features/workbench/components/WorkbenchMount.js";
import type { PluginContext } from "@astravia-org/plugin-sdk";

/**
 * 工作区的「整页」形态：注册成宿主的 workspace view，让工作台占据主内容区。
 *
 * 这不是覆盖层。宿主把视图当成一个真实页面（`plugin-workspace/<pluginId>/<viewId>`），
 * 侧栏、标题栏、聊天区都还在，排版由宿主负责——插件不必也不该自己 `fixed inset-0`，
 * 那会盖住宿主的 chrome，面板一换宽度就撑坏。
 *
 * `sidebar: true`：这条视图必须是一条**真正的页面路由**（`/workspace/<pluginId>/<viewId>`）。
 * 写 `false` 的语义是「不占侧栏、只在 设置 → 更多 里内嵌打开」——宿主会把导航改写成
 * `/settings/extensions?view=…`，于是「全屏」变成「落进设置页」：设置自己的侧栏、设置页头、
 * 宿主侧栏全都在，用户看到的不是全屏，而是又一个嵌在设置里的面板。那句「全屏显示整个插件」
 * 剩下的唯一可行解就是把视图挂成与内置页平级的路由：主内容区归它独占，宿主侧栏仍由用户自己收。
 * 顺带的好处：侧栏多了一个通往工作台的一键入口（默认落在「更多」收纳，用户可自己钉到顶部）。
 *
 * 组件用 `createElement` 而不是 JSX，好让这个文件保持 `.ts`——`.tsx` 必须待在
 * feature/shared 的 `components/` 目录下（打包与代码组织两侧的约定）。
 */
export function registerStudioView(ctx: PluginContext) {
	const component: ComponentType = () => createElement(WorkbenchMount, { surface: "page" });

	return ctx.ui.registerWorkspaceView({
		id: STUDIO_VIEW_ID,
		label: "%view.studio.label%",
		icon: "icon-[solar--book-2-linear]",
		sidebar: true,
		component,
	});
}
