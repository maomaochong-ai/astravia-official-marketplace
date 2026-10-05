/**
 * 连接树节点身份 — key 的编解码。
 *
 * 树要用 key 做三件事：React key、展开集合的成员、懒加载分发。因此 key 必须能
 * 无损还原出「谁」，又不能被分隔符歧义。
 *
 * 数据库对象名允许几乎任意字符，连接名也允许冒号，所以早先用
 * `${kind}:${a}:${b}` 拼接再 `lastIndexOf(":")` 取表名是不安全的：
 * 表名 `order:detail` 会被截成 `detail`。这里把每段先做
 * `encodeURIComponent`（它会转义 `:`、`/`、`#`、`?`），再用 `:` 连接，
 * 于是分段唯一、可逆，解析不需要任何启发式。
 */

export type TreeNodeKind = "connection" | "schema" | "table" | "column";

export interface TreeNode {
	key: string;
	kind: TreeNodeKind;
	label: string;
	/** 原始 db 类型（connection 节点才有）。 */
	dbType?: string;
	/** 表类型（table 节点才有）。 */
	tableKind?: string;
	hasChildren?: boolean;
}

/** 一层树节点的身份：解析 key 得到的原始名。 */
export interface TableNodeRef {
	connection: string;
	/** 无 schema 层（SQLite 等）时为空串。 */
	schema: string;
	table: string;
}

/** 列节点的身份：解析 key 得到连接 / schema / 表 / 列名。 */
export interface ColumnNodeRef extends TableNodeRef {
	column: string;
}

function encodeSegments(parts: readonly string[]): string {
	return parts.map((p) => encodeURIComponent(p)).join(":");
}

function decodeSegment(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		// 理论上不会发生（key 全由本模块生成）；真遇到脏数据也不该让整棵树崩掉。
		return segment;
	}
}

export function connectionNodeKey(connection: string): string {
	return `conn:${encodeSegments([connection])}`;
}

export function schemaNodeKey(connection: string, schema: string): string {
	return `schema:${encodeSegments([connection, schema])}`;
}

export function tableNodeKey(connection: string, schema: string | undefined, table: string): string {
	return `table:${encodeSegments([connection, schema ?? "", table])}`;
}

export function columnNodeKey(
	connection: string,
	schema: string | undefined,
	table: string,
	column: string,
): string {
	return `col:${encodeSegments([connection, schema ?? "", table, column])}`;
}

/** key 的种类；不属于树节点时返回 null。 */
export function treeNodeKind(key: string): TreeNodeKind | null {
	const kind = key.slice(0, key.indexOf(":"));
	switch (kind) {
		case "conn":
			return "connection";
		case "schema":
		case "table":
			return kind;
		case "col":
			return "column";
		default:
			return null;
	}
}

/** 从 key 取连接名。三种带连接名的 key 都在第 1 段。 */
export function connectionFromNodeKey(key: string): string | null {
	const segments = key.split(":").slice(1);
	const first = segments[0];
	return first === undefined ? null : decodeSegment(first);
}

/** 从表节点 key 还原连接 / schema / 表名。key 不是 table: 时返回 null。 */
export function parseTableNodeKey(key: string): TableNodeRef | null {
	if (treeNodeKind(key) !== "table") return null;
	const segments = key.split(":").slice(1);
	if (segments.length !== 3) return null;
	const [connection, schema, table] = segments.map(decodeSegment);
	return { connection, schema, table };
}

/** 从列节点 key 还原连接 / schema / 表 / 列名。key 不是 col: 时返回 null。 */
export function parseColumnNodeKey(key: string): ColumnNodeRef | null {
	if (treeNodeKind(key) !== "column") return null;
	const segments = key.split(":").slice(1);
	if (segments.length !== 4) return null;
	const [connection, schema, table, column] = segments.map(decodeSegment);
	return { connection, schema, table, column };
}