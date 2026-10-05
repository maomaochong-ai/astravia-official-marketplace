/**
 * 连接树 → SQL 编辑器的拖拽协议。
 *
 * 对齐 dbx 桌面壳：把树里的表 / 列拖进 SQL 编辑器，在落点插入对应的 SQL 引用文本。
 * 自定义 MIME 承载结构化载荷（插入限定名 / 列名），同时写 text/plain 兜底，
 * 让树节点也能拖到插件外（系统文本输入框）得到纯文本。
 */

import type { TreeNodeKind } from "./tree-node-key";

export const TABLE_DRAG_MIME = "application/x-dbx-node";

export interface TableDragPayload {
	kind: TreeNodeKind;
	/** 所属连接名。 */
	connectionName: string;
	/** 表节点所属 schema（无 schema 层时为 undefined）。 */
	schema?: string;
	/** 表名（table / column 节点）。 */
	tableName?: string;
	/** 列名（column 节点，树标签就是原始列名）。 */
	columnName?: string;
	/** schema.table 或 table 限定名，直接作为 SQL 引用插入。 */
	qualifiedName: string;
}

/** 按当前节点身份构造拖拽载荷。 */
export function buildTableDragPayload(
	kind: TreeNodeKind,
	scope: { connectionName: string; schema?: string; tableName?: string; columnName?: string; label: string },
): TableDragPayload {
	const qualifiedName = kind === "column"
		? scope.columnName ?? scope.label
		: scope.schema && kind === "table"
			? `${scope.schema}.${scope.label}`
			: scope.label;
	return {
		kind,
		connectionName: scope.connectionName,
		...(scope.schema ? { schema: scope.schema } : {}),
		...(scope.tableName ? { tableName: scope.tableName } : {}),
		...(scope.columnName ? { columnName: scope.columnName } : {}),
		qualifiedName,
	};
}

/** dataTransfer 写入：自定义 MIME + text/plain 兜底。 */
export function writeTableDragPayload(dataTransfer: DataTransfer, payload: TableDragPayload): void {
	dataTransfer.setData(TABLE_DRAG_MIME, JSON.stringify(payload));
	dataTransfer.setData("text/plain", tableDragInsertText(payload));
	dataTransfer.effectAllowed = "copy";
}

/** 从拖拽事件读取载荷：优先自定义 MIME，text/plain 不作为结构化回退（无法还原限定名）。 */
export function readTableDragPayload(dataTransfer: DataTransfer): TableDragPayload | null {
	const raw = dataTransfer.getData(TABLE_DRAG_MIME);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<TableDragPayload>;
		if (
			parsed &&
			typeof parsed.kind === "string" &&
			typeof parsed.connectionName === "string" &&
			typeof parsed.qualifiedName === "string"
		) {
			return parsed as TableDragPayload;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * 放置后插入编辑器的 SQL 文本：
 * - 列：原始列名（多列拖拽等扩展走同一出口）
 * - 表：schema.table 限定名（与树菜单 / 预览生成的 SQL 口径一致，不在此处做方言加引号）
 * - schema / 连接：节点名本身
 */
export function tableDragInsertText(payload: TableDragPayload): string {
	if (payload.kind === "column") return payload.columnName ?? payload.qualifiedName;
	return payload.qualifiedName;
}
