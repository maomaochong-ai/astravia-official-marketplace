/**
 * SQL 编辑器的拖放处理 — 把连接树拖来的表 / 列引用插到落点。
 *
 * CodeMirror 自身只处理「编辑器内部选区拖动」和浏览器原生 text/plain 投放；
 * 这里在 drop 时 preventDefault 阻断浏览器默认插入，再用 posAtCoords 精确定位
 * 落点（而不是只读光标当前位置），插入自定义 MIME 载荷对应的 SQL 文本。
 */

import type { EditorView } from "@codemirror/view";
import { readTableDragPayload, tableDragInsertText, TABLE_DRAG_MIME } from "../../../domain/table-drag";

/** dragover：是否是连接树拖来的载荷（types 在 dragover 阶段即可读）。 */
export function isTableDragOver(event: React.DragEvent): boolean {
	return Array.from(event.dataTransfer.types ?? []).includes(TABLE_DRAG_MIME);
}

/**
 * drop：在鼠标坐标对应的文档位置插入引用文本。
 * 返回是否成功插入（调用方据此决定是否 preventDefault）。
 */
export function insertTableDrop(
	view: EditorView,
	event: React.DragEvent,
): boolean {
	const payload = readTableDragPayload(event.dataTransfer);
	if (!payload) return false;
	const text = tableDragInsertText(payload);
	if (!text) return false;

	const coords = view.posAtCoords({ x: event.clientX, y: event.clientY });
	const anchor = coords ?? view.state.selection.main.head;
	view.focus();
	view.dispatch({
		changes: { from: anchor, insert: text },
		selection: { anchor: anchor + text.length },
		scrollIntoView: true,
		userEvent: "input.drop",
	});
	return true;
}
