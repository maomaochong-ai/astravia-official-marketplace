/**
 * auto-layout.ts — 画布自动布局（垂直 / 水平 / 网格）。
 *
 * 移植自 ComfyUI `apps/frontend/src/composables/graph/useArrangeNodes.ts`：
 *   - 锚点 = 左上最靠前的节点（min(posX + posY)），布局后仍钉在原位；
 *   - 垂直/水平按“先上后下 / 先左后右”排序后依次累加尺寸 + 间隙；
 *   - 网格 cols = ceil(sqrt(n))，列宽取列内最大宽度、行高取行内最大高度，
 *     再用累积偏移铺开（等价 ComfyUI 的 cumulativeOffsets）。
 *
 * 差异：ComfyUI 的节点有独立标题栏（NODE_TITLE_HEIGHT），位置不含标题；
 * 本插件的 NodePos { x, y, w, h } 里 h 已经含卡片头，所以 titleHeight 恒为 0，
 * 视觉盒 == 几何盒。间隙默认也从 12 提到 32 —— BI 节点比 litegraph 节点大得多。
 */

export type ArrangeLayout = "vertical" | "horizontal" | "grid";

/** BI 节点体量大，默认间隙比 ComfyUI 的 12 宽。 */
export const DEFAULT_ARRANGE_GAP = 32;
export const MIN_ARRANGE_GAP = 0;
export const MAX_ARRANGE_GAP = 96;

export interface ArrangeLayoutOption {
	layout: ArrangeLayout;
	label: string;
	icon: string;
}

export const ARRANGE_LAYOUTS: ArrangeLayoutOption[] = [
	{ layout: "vertical", label: "垂直排列", icon: "icon-[lucide--arrow-down-up]" },
	{ layout: "horizontal", label: "水平排列", icon: "icon-[lucide--arrow-left-right]" },
	{ layout: "grid", label: "网格排列", icon: "icon-[lucide--layout-grid]" },
];

export interface ArrangeBox {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface ArrangeUpdate {
	nodeId: string;
	x: number;
	y: number;
}

const byTopDown = (a: ArrangeBox, b: ArrangeBox) => a.y - b.y || a.x - b.x;
const byLeftRight = (a: ArrangeBox, b: ArrangeBox) => a.x - b.x || a.y - b.y;

const findAnchor = (boxes: ArrangeBox[]): ArrangeBox =>
	boxes.reduce((best, box) => (box.x + box.y < best.x + best.y ? box : best));

/** 从 origin 开始，按 sizes + gap 依次累加出每一项的起点。 */
function cumulativeOffsets(sizes: number[], origin: number, gap: number): number[] {
	const offsets: number[] = [origin];
	for (let i = 1; i < sizes.length; i++) offsets.push(offsets[i - 1] + sizes[i - 1] + gap);
	return offsets;
}

function arrangeVertical(boxes: ArrangeBox[], anchor: ArrangeBox, gap: number): ArrangeUpdate[] {
	const sorted = [...boxes].sort(byTopDown);
	let top = anchor.y;
	return sorted.map((box) => {
		const update: ArrangeUpdate = { nodeId: box.id, x: anchor.x, y: top };
		top += box.h + gap;
		return update;
	});
}

function arrangeHorizontal(boxes: ArrangeBox[], anchor: ArrangeBox, gap: number): ArrangeUpdate[] {
	const sorted = [...boxes].sort(byLeftRight);
	let left = anchor.x;
	return sorted.map((box) => {
		const update: ArrangeUpdate = { nodeId: box.id, x: left, y: anchor.y };
		left += box.w + gap;
		return update;
	});
}

function arrangeGrid(boxes: ArrangeBox[], anchor: ArrangeBox, gap: number): ArrangeUpdate[] {
	const sorted = [...boxes].sort(byTopDown);
	const cols = Math.ceil(Math.sqrt(sorted.length));
	const rows = Math.ceil(sorted.length / cols);

	const colWidths = Array.from({ length: cols }, () => 0);
	const rowHeights = Array.from({ length: rows }, () => 0);
	sorted.forEach((box, i) => {
		const col = i % cols;
		const row = Math.floor(i / cols);
		if (box.w > colWidths[col]) colWidths[col] = box.w;
		if (box.h > rowHeights[row]) rowHeights[row] = box.h;
	});

	const colX = cumulativeOffsets(colWidths, anchor.x, gap);
	const rowY = cumulativeOffsets(rowHeights, anchor.y, gap);

	return sorted.map((box, i) => ({
		nodeId: box.id,
		x: colX[i % cols],
		y: rowY[Math.floor(i / cols)],
	}));
}

export function clampArrangeGap(gap: number): number {
	if (!Number.isFinite(gap)) return DEFAULT_ARRANGE_GAP;
	return Math.min(MAX_ARRANGE_GAP, Math.max(MIN_ARRANGE_GAP, Math.round(gap)));
}

/**
 * 计算布局结果。少于 2 个节点直接返回空数组（单个节点无处可排，
 * 与 ComfyUI `computeArrangement` 的 `nodes.length < 2` 短路一致）。
 */
export function computeArrangement(
	boxes: ArrangeBox[],
	layout: ArrangeLayout,
	gap: number = DEFAULT_ARRANGE_GAP,
): ArrangeUpdate[] {
	if (boxes.length < 2) return [];
	const safeGap = clampArrangeGap(gap);
	const anchor = findAnchor(boxes);
	if (layout === "vertical") return arrangeVertical(boxes, anchor, safeGap);
	if (layout === "horizontal") return arrangeHorizontal(boxes, anchor, safeGap);
	return arrangeGrid(boxes, anchor, safeGap);
}

/** 把布局结果写回节点表（不修改入参）。 */
export function applyArrangement<T extends { x: number; y: number }>(
	nodes: Record<string, T>,
	updates: ArrangeUpdate[],
): Record<string, T> {
	if (updates.length === 0) return nodes;
	const next = { ...nodes };
	for (const u of updates) {
		const node = next[u.nodeId];
		if (!node) continue;
		next[u.nodeId] = { ...node, x: u.x, y: u.y };
	}
	return next;
}
