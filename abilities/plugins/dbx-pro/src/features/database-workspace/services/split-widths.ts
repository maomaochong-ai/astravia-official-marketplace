/**
 * 三栏工作台的宽度约束。
 *
 * 抽成纯函数是因为这里的算术决定了「三栏能不能撑破容器」，而组件本身很难在测试里复现
 * 宿主面板变窄这一时序。约束来源见设计稿 WorkbenchGhost.tsx（左树 248px / 右历史栏 300px）。
 */

/** 设计稿的固定栏宽（WorkbenchGhost.tsx：左树 248px、右历史栏 300px）。 */
export const DESIGN_LEFT = 248;
export const DESIGN_RIGHT = 300;

/** 宿主面板窄于此宽度时改用比例分配，避免中栏被挤没。 */
export const NARROW_BREAKPOINT = 900;

/** 左栏收起后退化成的图标列宽度（设计稿 ConnectionTree 的收起态）。 */
export const LEFT_COLLAPSED = 36;

/** 两条 1px 发丝分隔线占用的宽度。 */
export const SPLITBAR_TOTAL = 2;

/** 各栏像素约束（中栏始终保留，分隔线无法拖到不合理的大小） */
export const MIN_LEFT = 180;
export const MAX_LEFT_RATIO = 0.4;
export const MIN_RIGHT = 260;
export const MAX_RIGHT_RATIO = 0.5;
export const MIN_MID = 344;

/** 首次挂载（或容器宽度未知时）的默认栏宽。 */
export function defaultWidths(total: number): { left: number; right: number } {
	if (total > 0 && total < NARROW_BREAKPOINT) {
		return { left: Math.round(total * 0.26), right: Math.round(total * 0.28) };
	}
	return { left: DESIGN_LEFT, right: DESIGN_RIGHT };
}

/**
 * 把左右两栏收进「容器宽 − 中栏最小宽」。
 *
 * 拖拽只夹住了被拖的一侧，另一侧仍是会话里存下的旧宽度，两者相加就可能撑破容器
 * （三栏之和大于容器宽，根节点的 overflow-hidden 会把右栏整块切掉）。这里统一收口：
 * 先按各自可让出的余量等比例退让；容器连两条最小宽度都装不下时整体等比压缩，中栏优先。
 */
export function fitWidths(
	total: number,
	left: number,
	right: number,
	stub = 0,
): { left: number; right: number } {
	const available = total - stub - SPLITBAR_TOTAL - MIN_MID;
	if (left + right <= 0 || left + right <= available) return { left, right };
	const leftRoom = Math.max(0, left - MIN_LEFT);
	const rightRoom = Math.max(0, right - MIN_RIGHT);
	const room = leftRoom + rightRoom;
	const over = left + right - available;
	if (room > 0 && over <= room) {
		const cut = Math.round((over * leftRoom) / room);
		return { left: left - cut, right: right - (over - cut) };
	}
	const scale = Math.max(0, available) / (left + right);
	return { left: Math.round(left * scale), right: Math.round(right * scale) };
}
