import { useCallback, useEffect, useState } from "react";
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
 * 路由记在模块里而不是组件里：标签页与工作区视图是同一个界面的两个宿主位置，
 * 来回切一次会把整棵工作台重新挂载，状态跟着组件走就会把你从第 26 章弹回书架。
 * 这里只存一个页面名，代价可以忽略。
 *
 * 两个导出函数给「工作台之外」的调用点用：对话里的落章卡片先记住去哪儿，再打开标签页——
 * 它自己没有组件实例可以调 `navigate`。订阅让已经挂着的实例跟上这次外部改动。
 */
let memory: WorkbenchRoute = { page: "shelf" };

const listeners = new Set<(route: WorkbenchRoute) => void>();

export function rememberRoute(page: WorkbenchPage, chapter?: number): void {
	memory = { page, chapter };
	for (const listener of listeners) listener(memory);
}

export function useWorkbenchRoute(initial: WorkbenchPage = "shelf"): WorkbenchRouteState {
	const [route, setRoute] = useState<WorkbenchRoute>(() => (memory.page === "shelf" ? { page: initial } : memory));

	useEffect(() => {
		listeners.add(setRoute);
		// 挂载的这一刻别人可能刚改过，补一次。
		setRoute(memory);
		return () => {
			listeners.delete(setRoute);
		};
	}, []);

	const navigate = useCallback((page: WorkbenchPage, chapter?: number) => {
		memory = { page, chapter };
		setRoute(memory);
	}, []);

	return { route, navigate };
}
