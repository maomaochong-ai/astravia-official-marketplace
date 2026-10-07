/**
 * 右键菜单的边界定位计算 —— 纯函数，不碰 DOM。
 *
 * 面板类 UI 不能 portal 到 document.body、也不能用 fixed（见 context-menu.tsx 的定位约束），
 * 因此所有坐标都以「面板根（.dbx-root）矩形」为基准，由调用方传入实测矩形。
 * 这里只做一件事：把一个想开在 (x, y) 的菜单摆进面板矩形内，放不下就翻转 / 贴边 / 限高滚动。
 */

/** 矩形（与 DOMRect 同形，便于直接取用实测值）。 */
export interface PlacementRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
}

/** 元素尺寸（实测）。 */
export interface PlacementSize {
	width: number;
	height: number;
}

/** 定位结果：面板根坐标系下的左上角与必要的尺寸上限。 */
export interface MenuBox {
	left: number;
	top: number;
	/** 面板高度不足时菜单的内部滚动上限；够放时为 null。 */
	maxHeight: number | null;
	/** 面板宽度不足时的宽度上限；够放时为 null。 */
	maxWidth: number | null;
}

export interface SubmenuBox extends MenuBox {
	/** 是否向左展开（右侧空间不足且左侧更宽裕）。 */
	flipLeft: boolean;
}

/** 主菜单固定宽度（与 ContextMenu 的 style.width 一致）。 */
export const CONTEXT_MENU_WIDTH = 208;
/** 子菜单最小宽度：内容更窄时按此收口，避免一行两个字。 */
export const SUBMENU_MIN_WIDTH = 172;
/** 菜单与面板边缘的最小间隙。 */
export const VIEWPORT_MARGIN = 4;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

/**
 * 主菜单定位：把屏幕坐标 (x, y) 换算成面板内坐标，越界时贴边。
 *
 * 菜单比面板还高时不再让它溢出下边界（会被面板裁掉），而是限高 + 内部滚动。
 */
export function placeContextMenu(options: {
	/** 面板根矩形（屏幕坐标）。 */
	root: PlacementRect;
	/** 期望打开的屏幕坐标（右键位置）。 */
	x: number;
	y: number;
	/** 实测菜单尺寸。 */
	size: PlacementSize;
	/** 菜单布局宽度。 */
	width: number;
}): MenuBox {
	const { root, x, y, size, width } = options;
	const availWidth = Math.max(root.width - VIEWPORT_MARGIN * 2, 0);
	const availHeight = Math.max(root.height - VIEWPORT_MARGIN * 2, 0);
	const boxWidth = Math.min(width, availWidth);
	const boxHeight = Math.min(size.height, availHeight);
	return {
		left: clamp(x - root.left, VIEWPORT_MARGIN, root.width - boxWidth - VIEWPORT_MARGIN),
		top: clamp(y - root.top, VIEWPORT_MARGIN, root.height - boxHeight - VIEWPORT_MARGIN),
		maxHeight: size.height > availHeight ? availHeight : null,
		maxWidth: width > availWidth ? availWidth : null,
	};
}

/**
 * 子菜单定位：以父项矩形为锚点。
 *
 * - 水平：默认向右展开并与父项重叠 1px；右侧放不下且左侧更宽裕时翻到左侧。
 * - 垂直：与父项顶部对齐；下方放不下时整体上移，仍放不下则限高内部滚动。
 *
 * 尺寸用实测值而不是常量：子菜单宽度由内容决定，按常量翻转会在长标签上算错边界。
 */
export function placeSubmenu(options: {
	root: PlacementRect;
	/** 父项（触发子菜单的菜单项）矩形，屏幕坐标。 */
	anchor: PlacementRect;
	size: PlacementSize;
	/** 最小宽度（内容更窄时按此收口）。 */
	minWidth: number;
}): SubmenuBox {
	const { root, anchor, size, minWidth } = options;
	const availWidth = Math.max(root.width - VIEWPORT_MARGIN * 2, 0);
	const availHeight = Math.max(root.height - VIEWPORT_MARGIN * 2, 0);
	const naturalWidth = Math.max(size.width, minWidth);
	const width = Math.min(naturalWidth, availWidth);
	const boxHeight = Math.min(size.height, availHeight);

	const anchorLeft = anchor.left - root.left;
	const anchorRight = anchor.right - root.left;
	const spaceRight = root.width - VIEWPORT_MARGIN - anchorRight;
	const spaceLeft = anchorLeft - VIEWPORT_MARGIN;
	// 右侧装不下、且左侧更宽裕时才翻转；两侧都装不下就贴住较宽的一侧（宁可压住父菜单也不出界）。
	const flipLeft = width > spaceRight && spaceLeft > spaceRight;
	const rawLeft = flipLeft ? anchorLeft + 1 - width : anchorRight - 1;

	return {
		left: clamp(rawLeft, VIEWPORT_MARGIN, root.width - width - VIEWPORT_MARGIN),
		top: clamp(anchor.top - root.top, VIEWPORT_MARGIN, root.height - boxHeight - VIEWPORT_MARGIN),
		maxHeight: size.height > availHeight ? availHeight : null,
		maxWidth: naturalWidth > availWidth ? availWidth : null,
		flipLeft,
	};
}
