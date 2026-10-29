import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { StudioWorkspaceView } from "./features/studio/components/StudioWorkspaceView.js";
import { STUDIO_VIEW_ICON, STUDIO_VIEW_ID } from "./view-ids.js";

let disposable: Disposable | null = null;

/**
 * 侧边栏项只在凭证验过之后才存在——这是产品要求，也是权限面最小化的自然结果。
 * 视图注册是"注册即可见"，所以未激活时根本不注册，而不是注册后隐藏。
 */
export function ensureStudioView(ctx: PluginContext): void {
	if (disposable) return;
	disposable = ctx.ui.registerWorkspaceView({
		id: STUDIO_VIEW_ID,
		label: "%view.studio.label%",
		description: "%view.studio.description%",
		icon: STUDIO_VIEW_ICON,
		component: StudioWorkspaceView,
		navOrder: 0,
		sidebar: true,
	});
}

export function disposeStudioView(): void {
	disposable?.dispose();
	disposable = null;
}
