/**
 * 连接树 → 宿主 AI 对话框的拖拽协议（艾规范）。
 *
 * 宿主输入框把 `` @`...` `` 提及语法渲染成标签（chip），解析规则见
 * docs/adr-0001-ai-interaction.md：
 *   - 连接：`` @`连接名` ``
 *   - 表：  `` @`连接名:schema.表名` ``（无 schema 层时 `` @`连接名:表名` ``）
 * 拖拽时把这些 token 写进 text/plain，宿主富文本输入框在原生 drop 后按同一
 * 语法转成标签；用户可继续输入问题再发送。列不属于可提及对象，拖列时插入
 * 所属表的标签 + 纯文本列名。
 *
 * 多选：多选模式下拖任意已选节点，携带整组选中对象，按连接分组、去重后一次插入。
 */

import type { DragEvent } from "react";

export type AiNodeKind = "connection" | "schema" | "table" | "column";

/**
 * 可作为 @提及 对象的节点种类。连接树里多了例程 / 例程分组这类节点后，
 * 拖拽与多选载荷都要先过这一关 —— 宿主提及语法只认识连接 / schema / 表 / 列。
 */
export function isMentionableKind(kind: string): kind is AiNodeKind {
	return kind === "connection" || kind === "schema" || kind === "table" || kind === "column";
}

export interface AiNodeInfo {
	kind: AiNodeKind;
	/** 所属连接名。 */
	connectionName: string;
	/** schema 名（table / column 节点所属 schema；无 schema 层时为 undefined）。 */
	schema?: string;
	/** 表名（table / column）。 */
	tableName?: string;
	/** 列名（column）。 */
	columnName?: string;
	/** 节点显示名（schema / connection 用）。 */
	label: string;
}

/** 表的限定名：schema.table 或 table。 */
function qualifiedTable(info: AiNodeInfo): string {
	return info.schema ? `${info.schema}.${info.tableName ?? info.label}` : (info.tableName ?? info.label);
}

/** 单个节点 → 宿主输入框中的提及文本。 */
export function buildNodeMention(info: AiNodeInfo): string {
	switch (info.kind) {
		case "connection":
			return "@`" + info.connectionName + "`";
		case "table":
			return "@`" + info.connectionName + ":" + qualifiedTable(info) + "`";
		case "column":
			// 列不可单独提及：挂所属表标签，列名以纯文本跟随。
			return "@`" + info.connectionName + ":" + qualifiedTable(info) + "`." + (info.columnName ?? info.label);
		case "schema":
		default:
			// schema 暂无独立提及语法，沿用既有 @`schema名` 约定（见 buildMultiSelectPrompt）。
			return "@`" + info.label + "`";
	}
}

const KIND_ORDER: Record<AiNodeKind, number> = {
	connection: 0,
	schema: 1,
	table: 2,
	column: 3,
};

/**
 * 一组节点 → 一次拖拽插入的文本：
 * 按连接分组（保持传入顺序，即用户点选顺序），组内连接 → schema → 表排序，
 * 同连接相邻 token 用空格分隔，连接组之间也用空格（输入框内各自成标签）。
 */
export function buildNodesMentionText(infos: readonly AiNodeInfo[]): string {
	const seen = new Set<string>();
	const groups = new Map<string, AiNodeInfo[]>();

	for (const info of infos) {
		const token = buildNodeMention(info);
		if (seen.has(token)) continue;
		seen.add(token);
		const list = groups.get(info.connectionName);
		if (list) list.push(info);
		else groups.set(info.connectionName, [info]);
	}

	const parts: string[] = [];
	for (const list of groups.values()) {
		const sorted = [...list].sort((a, b) => {
			const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
			if (byKind !== 0) return byKind;
			// 同类按「schema.名称」字母序，保证标签顺序稳定可预期。
			return qualifiedTable(a).localeCompare(qualifiedTable(b));
		});
		parts.push(sorted.map(buildNodeMention).join(" "));
	}
	return parts.join(" ");
}

/**
 * 拖拽起点写入 dataTransfer：
 * - text/plain：@提及 token（宿主输入框原生 drop 落点，唯一必需的载荷）
 * - application/x-astravia-dbx-nodes：结构化 JSON，供插件内部 / 未来落点识别
 */
export function writeAiNodeDrag(dataTransfer: DataTransfer, infos: readonly AiNodeInfo[]): string {
	const list = infos.length > 0 ? infos : [];
	const text = buildNodesMentionText(list);
	dataTransfer.setData("text/plain", text);
	dataTransfer.setData("application/x-astravia-dbx-nodes", JSON.stringify(list));
	dataTransfer.effectAllowed = "copy";
	return text;
}

/** 拖拽幽灵上展示的短标签（不带 @ 反引号语法，纯展示）。 */
function ghostLabel(info: AiNodeInfo): string {
	switch (info.kind) {
		case "connection":
			return info.connectionName;
		case "schema":
			return info.label;
		case "column":
			return `${info.tableName ?? info.label}.${info.columnName ?? info.label}`;
		case "table":
		default:
			return info.schema ? `${info.schema}.${info.tableName ?? info.label}` : (info.tableName ?? info.label);
	}
}

const GHOST_SVG: Record<AiNodeKind, string> = {
	connection:
		'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v6"/></svg>',
	schema:
		'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 8 4.5-8 4.5-8-4.5L12 2Z"/><path d="m4 11 8 4.5L20 11"/><path d="m4 16 8 4.5L20 16"/></svg>',
	table:
		'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
	column:
		'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M8 7l4-4 4 4"/></svg>',
};

/**
 * 构造艾规范提及标签风格的拖拽幽灵。
 *
 * 挂到 document.body 上（脱离插件 @scope，样式全部内联），模拟宿主输入框中
 * @提及 chip 的外观：深色半透明底、圆角、对象图标 + 名称；多选时聚合成一组，
 * 超过 3 个显示「+N」。调用方在 dragstart 中 setDragImage 后下一帧移除。
 */
export function makeMentionDragGhost(infos: readonly AiNodeInfo[]): HTMLElement {
	const wrap = document.createElement("div");
	wrap.style.cssText = [
		"position:fixed",
		"top:-9999px",
		"left:-9999px",
		"z-index:99999",
		"display:flex",
		"flex-direction:column",
		"gap:4px",
		"pointer-events:none",
		"max-width:280px",
	].join(";");

	const MAX_VISIBLE = 3;
	const visible = infos.slice(0, MAX_VISIBLE);
	for (const info of visible) {
		wrap.appendChild(buildChip(info));
	}
	if (infos.length > MAX_VISIBLE) {
		const more = document.createElement("div");
		more.textContent = `+${infos.length - MAX_VISIBLE} 个对象`;
		more.style.cssText =
			"align-self:flex-start;font:500 11px -apple-system,BlinkMacSystemFont,'PingFang SC','Segoe UI',sans-serif;" +
			"padding:2px 8px;border-radius:9999px;color:#c8d4e6;background:rgba(255,255,255,0.08);";
		wrap.appendChild(more);
	}
	document.body.appendChild(wrap);
	return wrap;

	function buildChip(info: AiNodeInfo): HTMLElement {
		const chip = document.createElement("div");
		chip.style.cssText = [
			"display:inline-flex",
			"align-items:center",
			"gap:6px",
			"align-self:flex-start",
			"padding:3px 9px 3px 7px",
			"border-radius:8px",
			"font:500 11.5px -apple-system,BlinkMacSystemFont,'PingFang SC','Segoe UI',sans-serif",
			"color:#e9edf4",
			"background:rgba(30,36,48,0.94)",
			"border:1px solid rgba(255,255,255,0.16)",
			"box-shadow:0 6px 20px rgba(0,0,0,0.32)",
			"white-space:nowrap",
		].join(";");
		const icon = document.createElement("span");
		icon.style.cssText = "display:inline-flex;color:#8ab4ff;flex-shrink:0;";
		icon.innerHTML = GHOST_SVG[info.kind];
		const label = document.createElement("span");
		label.textContent = ghostLabel(info);
		chip.appendChild(icon);
		chip.appendChild(label);
		return chip;
	}
}

/** dragstart 中统一设置幽灵；下一帧从 DOM 移除（浏览器已快照）。 */
export function setMentionDragImage(event: DragEvent, infos: readonly AiNodeInfo[]): void {
	if (infos.length === 0 || !event.dataTransfer) return;
	const ghost = makeMentionDragGhost(infos);
	// 鼠标指针落在第一个 chip 左侧偏内，视觉上像"捏住"标签。
	event.dataTransfer.setDragImage(ghost, 10, 14);
	setTimeout(() => ghost.remove(), 0);
}
