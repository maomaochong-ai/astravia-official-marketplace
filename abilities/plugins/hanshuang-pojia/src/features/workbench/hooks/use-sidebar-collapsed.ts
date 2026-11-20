import { useCallback, useState } from "react";

const STORAGE_KEY = "hanshuang-pojia:sidebar-collapsed";

/**
 * 侧栏折叠状态：用户的选择，跨会话记住。
 *
 * 存 localStorage 而不是插件 storage：这是一个纯界面的开合偏好，
 * 与工作区 / 会话无关，也不该在「清理插件存储」时被一起删掉。
 * 读失败（隐私模式、配额满）就当没存过，界面仍然可用。
 */
export function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
	const [collapsed, setCollapsed] = useState<boolean>(() => {
		try {
			return localStorage.getItem(STORAGE_KEY) === "1";
		} catch {
			return false;
		}
	});

	const set = useCallback((next: boolean) => {
		setCollapsed(next);
		try {
			localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
		} catch {
			// 写不进去不影响本次会话的折叠效果。
		}
	}, []);

	return [collapsed, set];
}
