import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { StudioPageMount } from "./features/workbench/components/StudioPageMount.js";
import { STUDIO_VIEW_ID } from "./studio-ids.js";

/**
 * 工作台的第二个宿主形态：整页路由（`/workspace/mahua-writing-team/studio`）。
 *
 * 为什么需要它：宿主的活动面板有一条硬底线，面板再宽也要给会话区留 384px
 * （`ACTIVITY_PANEL_MIN_CHAT_AREA`，在 atom 层统一夹紧）。所以「全屏整个工作台」这件事
 * 在面板里**物理上做不到**——插件传任何宽度都会被夹回去。整页视图是宿主唯一会把主区
 * 整块让给插件的位置，报头的「全屏工作台」键走的就是这一跳。
 *
 * 代价写在明处，README 里也对用户说了：
 *
 * 1. 它会往宿主的侧栏「更多」里加一条「麻花小说网」——同一个界面因此有了两个入口；
 * 2. 侧栏本身不会被移除（那是宿主的导航，插件无权隐藏）；
 * 3. 从侧栏直接进来时没有「退回对话」可走，所以那种情况下一个返回键都不给。
 *
 * 侧栏是稀缺资源（宿主文档原话），所以这条入口给了 `description` 说清它是什么，
 * 而不靠用户猜。
 */
export function registerStudioView(ctx: PluginContext): Disposable {
	return ctx.ui.registerWorkspaceView({
		id: STUDIO_VIEW_ID,
		label: "%view.studio.label%",
		// 继承 `plugin.json` 的品牌图标（`assets/icon.svg`），不在图标集里找个近似图形凑数。
		//
		// 不传 `description`：宿主的侧栏标题对它做的是**原文**拼接，不走 `%key%` 翻译
		// （`useSidebarModel`），写给用户看的话只能是一门语言。缺省时标题回落成
		// 「麻花小说网 · 插件名」，同样读得懂。
		component: StudioPageMount,
	});
}
