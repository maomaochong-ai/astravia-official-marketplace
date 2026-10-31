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

/**
 * 路由记在模块里而不是组件里：全屏是覆盖层，切进切出会把整棵工作台重新挂载，
 * 状态跟着组件走就会把你从第 26 章弹回书架。这里只存一个页面名，代价可以忽略。
 */
let memory: WorkbenchRoute = { page: "shelf" };

export function useWorkbenchRoute(initial: WorkbenchPage = "shelf"): WorkbenchRouteState {
	const [route, setRoute] = useState<WorkbenchRoute>(() => (memory.page === "shelf" ? { page: initial } : memory));

	const navigate = useCallback((page: WorkbenchPage, chapter?: number) => {
		memory = { page, chapter };
		setRoute(memory);
	}, []);

	return { route, navigate };
}
