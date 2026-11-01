import { useEffect } from "react";
import { tryGetStudioRuntime } from "../../../plugin-context.js";
import { STUDIO_VIEW_ID } from "../../../studio-ids.js";

/**
 * 整页挂载时接管宿主的页头标题。
 *
 * 不给这一条，宿主的页头会照默认显示应用名，插件的报头再显示一次「麻花小说网」——
 * 两条横带叠着，第二条才是真的身份。这里把页头文字换成同一个标签文案，宿主的页头就只是
 * 窗口条（拖拽区、红黄绿、侧栏开关都在那儿，插件无权也不该动那些）。
 */
export function useWorkspaceViewTitle(): void {
	useEffect(() => {
		const runtime = tryGetStudioRuntime();
		if (!runtime) return;
		runtime.ctx.ui.setWorkspaceViewHeader(STUDIO_VIEW_ID, { title: "%view.studio.label%" });
		return () => runtime.ctx.ui.setWorkspaceViewHeader(STUDIO_VIEW_ID, null);
	}, []);
}
