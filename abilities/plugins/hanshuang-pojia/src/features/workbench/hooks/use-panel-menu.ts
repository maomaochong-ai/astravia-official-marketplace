import { useCallback, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

/**
 * 面板内的右键菜单。
 *
 * 为什么不用 `fixed` + `clientX/Y`：面板只是活动栏里的一格，`fixed` 以整个窗口为基准，
 * 宽窗口下菜单会画到宿主界面上。基准必须是**面板根**（`[data-panel-root]`），
 * 坐标因此要换算成相对面板的位置，并在这里钳进面板内 —— 越界比不弹更糟：
 * 用户看不到的那一半等于没有。
 */

export interface PanelMenuItem {
	id: string;
	label: string;
	/** 图标名，见 shell/icon-paths.ts。缺省不画。 */
	icon?: string;
	/** 右侧的补充说明：条数、后缀、快捷键。 */
	hint?: string;
	/** 破坏性动作（删除、清空）在菜单里用风险色，与普通动作分开。 */
	tone?: "default" | "danger";
	run(): void;
}

export interface PanelMenuGroup {
	id: string;
	items: readonly PanelMenuItem[];
}

export interface PanelMenu {
	/** 相对面板根的坐标。 */
	left: number;
	top: number;
	/** 菜单顶部的一行说明：右键的是哪一份、属于哪个包。 */
	heading?: string;
	groups: readonly PanelMenuGroup[];
}

export const MENU_WIDTH = 216;
/** 一行的高度与组间距：估算用，挂载后按实测高度再修正一次。 */
const ROW_HEIGHT = 30;
const GROUP_GAP = 7;
const HEADING_HEIGHT = 24;
const PADDING = 12;
const MARGIN = 8;

export function estimateMenuHeight(menu: PanelMenu): number {
	const rows = menu.groups.reduce((sum, group) => sum + group.items.length, 0);
	const gaps = Math.max(0, menu.groups.length - 1) * GROUP_GAP;
	return rows * ROW_HEIGHT + gaps + (menu.heading ? HEADING_HEIGHT : 0) + PADDING;
}

export interface MenuPoint {
	left: number;
	top: number;
}

export interface MenuSize {
	width: number;
	height: number;
}

/** 钳进面板：先保证不小于 margin，再保证右/下边留出 margin。面板比菜单还窄时靠左对齐。 */
export function clampMenu(point: MenuPoint, size: MenuSize, panel: MenuSize, margin = MARGIN): MenuPoint {
	const maxLeft = Math.max(margin, panel.width - size.width - margin);
	const maxTop = Math.max(margin, panel.height - size.height - margin);
	return {
		left: Math.round(Math.min(Math.max(margin, point.left), maxLeft)),
		top: Math.round(Math.min(Math.max(margin, point.top), maxTop)),
	};
}

function panelRect(node: HTMLElement | null): MenuSize {
	const root = node?.closest<HTMLElement>("[data-panel-root]") ?? null;
	const rect = root?.getBoundingClientRect();
	return { width: rect?.width ?? 360, height: rect?.height ?? 520 };
}

/** 右键点换算成「相对面板」的坐标，并先按估算尺寸钳一次。 */
export function pointFromEvent(event: ReactMouseEvent<HTMLElement>, height: number): MenuPoint {
	const rect = (event.currentTarget.closest<HTMLElement>("[data-panel-root]") ?? event.currentTarget).getBoundingClientRect();
	return clampMenu(
		{ left: event.clientX - rect.left, top: event.clientY - rect.top },
		{ width: MENU_WIDTH, height },
		{ width: rect.width, height: rect.height },
	);
}

export interface PanelMenuController {
	menu: PanelMenu | null;
	/** 在指针位置打开一份菜单。内容由调用方给，坐标与钳位由这里算。 */
	openAt(event: ReactMouseEvent<HTMLElement>, content: Omit<PanelMenu, "left" | "top">): void;
	/** 在面板某个固定位置打开（键盘触发、按钮下拉时用）。 */
	openNear(node: HTMLElement | null, content: Omit<PanelMenu, "left" | "top">): void;
	close(): void;
}

export function usePanelMenu(): PanelMenuController {
	const [menu, setMenu] = useState<PanelMenu | null>(null);

	const openAt = useCallback((event: ReactMouseEvent<HTMLElement>, content: Omit<PanelMenu, "left" | "top">) => {
		event.preventDefault();
		event.stopPropagation();
		const height = estimateMenuHeight({ ...content, left: 0, top: 0 });
		setMenu({ ...content, ...pointFromEvent(event, height) });
	}, []);

	const openNear = useCallback((node: HTMLElement | null, content: Omit<PanelMenu, "left" | "top">) => {
		if (!node) return;
		const rect = node.getBoundingClientRect();
		const root = node.closest<HTMLElement>("[data-panel-root]") ?? node;
		const base = root.getBoundingClientRect();
		const height = estimateMenuHeight({ ...content, left: 0, top: 0 });
		setMenu({
			...content,
			...clampMenu(
				// 贴按钮左下角弹出：菜单不盖住触发它的那枚按钮。
				{ left: rect.left - base.left, top: rect.bottom - base.top + 4 },
				{ width: MENU_WIDTH, height },
				panelRect(node),
			),
		});
	}, []);

	const close = useCallback(() => setMenu(null), []);

	return { menu, openAt, openNear, close };
}
