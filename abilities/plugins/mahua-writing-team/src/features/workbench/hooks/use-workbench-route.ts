import { useCallback, useState } from "react";
import type { WorkbenchPage, WorkbenchRoute } from "../workbench-pages.js";

/**
 * 七帧之间的切换：一个页面名加一个可选章号，够用，因此不引路由库。
 *
 * 面板是标签页，不是网站——地址栏不存在，也不需要「按后退回到上一页」之外的语义。
 * 页面内部再细的切换（选中哪本、读哪一章）由 `useStudioState` 与各页自己持有。
 */
export interface WorkbenchRouteState {
	route: WorkbenchRoute;
	navigate: (page: WorkbenchPage, chapter?: number) => void;
}

export function useWorkbenchRoute(initial: WorkbenchPage = "shelf"): WorkbenchRouteState {
	const [route, setRoute] = useState<WorkbenchRoute>({ page: initial });

	const navigate = useCallback((page: WorkbenchPage, chapter?: number) => {
		setRoute({ page, chapter });
	}, []);

	return { route, navigate };
}
