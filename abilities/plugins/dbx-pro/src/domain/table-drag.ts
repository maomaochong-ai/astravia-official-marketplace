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

export type AiNodeKind = "connection" | "schema" | "table" | "column";

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
