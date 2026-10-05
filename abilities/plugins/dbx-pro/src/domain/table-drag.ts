/**
 * 连接树拖拽协议 — 把树节点拖进宿主 AI 对话框。
 *
 * 落点是宿主的对话输入框（插件外 DOM），插件无法在其上挂自己的 drop 处理，
 * 因此只用浏览器原生 text/plain 承载一段 AI 可读的引用文本：任何标准输入框 /
 * contenteditable 在 drop 时都会把它插到光标处，用户可在此基础上继续提问再发送。
 *
 * 文本口径：
 * - 表：schema.table（无 schema 层时 table）
 * - 列：schema.table.column，让 AI 知道列属于哪张表
 * - schema / 连接：节点名本身
 */

import type { TreeNodeKind } from "./tree-node-key";

export interface NodeDragScope {
	connectionName: string;
	schema?: string;
	tableName?: string;
	columnName?: string;
	label: string;
}

/** 生成拖入 AI 输入框的引用文本。 */
export function buildNodeReferenceText(kind: TreeNodeKind, scope: NodeDragScope): string {
	if (kind === "column") {
		const prefix = scope.schema ? `${scope.schema}.` : "";
		return `${prefix}${scope.tableName ?? ""}.${scope.columnName ?? scope.label}`;
	}
	if (kind === "table") {
		return scope.schema ? `${scope.schema}.${scope.label}` : scope.label;
	}
	return scope.label;
}

/**
 * 拖拽起点写入 dataTransfer。
 * text/plain 供宿主输入框原生落点插入；自定义 MIME 仅标识数据来源。
 */
export function writeNodeDragPayload(dataTransfer: DataTransfer, kind: TreeNodeKind, scope: NodeDragScope): string {
	const text = buildNodeReferenceText(kind, scope);
	dataTransfer.setData("text/plain", text);
	dataTransfer.setData("application/x-dbx-node", kind);
	dataTransfer.effectAllowed = "copy";
	return text;
}
