import { useCallback, useEffect, useState } from "react";

/**
 * 窄栏是否收成了图标列。
 *
 * 存在模块级：标签页 ⇄ 工作区视图之间的切换会把整棵树重新挂载一次，收栏是个使用偏好，
 * 不该因为切了一次「放大」就弹回来。与 `use-workbench-route` 的 `memory` 同一个理由。
 *
 * 订阅是为了让可能同时挂着的两个入口（面板里的、整页里的）读到同一个值。
 */
let memory = false;
const listeners = new Set<(collapsed: boolean) => void>();

export function useRailCollapsed(): { collapsed: boolean; toggle(): void } {
	const [collapsed, setCollapsed] = useState(memory);

	useEffect(() => {
		listeners.add(setCollapsed);
		setCollapsed(memory);
		return () => {
			listeners.delete(setCollapsed);
		};
	}, []);

	const toggle = useCallback(() => {
		memory = !memory;
		for (const listener of listeners) listener(memory);
	}, []);

	return { collapsed, toggle };
}
