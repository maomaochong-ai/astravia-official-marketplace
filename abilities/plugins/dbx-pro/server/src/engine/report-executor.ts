/**
 * report-executor —— 报表 SQL 执行 + 参数替换 + 分组聚合 + 多级表头推断。
 *
 * 纯函数 / 副作用函数分开：
 *   execReport          —— 纯函数：rows + groupBy → 分组聚合 rows
 *   inferHeaderTree     —— 纯函数：columns + groupBy → 多级表头树
 *   executeReportSql    —— 副作用：参数替换 + 安全检查 + 调 dbx-mcp 执行
 */

/**
 * 纯函数：对已取回的 rows 做分组小计/合计。
 * @param {{ columns: string[], rows: object[], options?: { groupBy?: string[], totals?: boolean } }} params
 */
export function execReport({ columns, rows, options = {} }: { columns: string[]; rows: Record<string, unknown>[]; options?: { groupBy?: string[]; totals?: boolean } }) {
	const groupBy = options.groupBy ?? [];
	if (groupBy.length === 0) return { columns, rows, groups: [] };

	// 按 groups 排序
	const sorted = [...rows].sort((a, b) => {
		for (const g of groupBy) {
			const av = String(a[g] ?? "");
			const bv = String(b[g] ?? "");
			if (av !== bv) return av.localeCompare(bv);
		}
		return 0;
	});

	// 数值列（用于合计）
	const firstRow = sorted[0] ?? {};
	const numericCols = columns.filter(c => {
		const v = firstRow[c];
		return typeof v === "number" || (typeof v === "string" && !isNaN(parseFloat(v)) && v.trim() !== "");
	});

	const result = [];
	let currentGroup = null;
	let groupRows = [];
	const groups = [];

	for (const row of sorted) {
		const groupKey = groupBy.map(g => String(row[g] ?? "")).join("||");
		if (currentGroup !== null && groupKey !== currentGroup) {
			result.push(...groupRows);
			// 小计行
			const subtotal = {};
			for (const c of groupBy) subtotal[c] = groupRows[0][c];
			subtotal["_isSubtotal"] = true;
			for (const c of numericCols) subtotal[c] = groupRows.reduce((s, r) => s + (Number(r[c]) || 0), 0);
			result.push(subtotal);
			groups.push({ key: currentGroup, rows: groupRows.length });
			groupRows = [];
		}
		currentGroup = groupKey;
		groupRows.push(row);
	}
	// 最后一组
	if (groupRows.length > 0) {
		result.push(...groupRows);
		const subtotal = {};
		for (const c of groupBy) subtotal[c] = groupRows[0][c];
		subtotal["_isSubtotal"] = true;
		for (const c of numericCols) subtotal[c] = groupRows.reduce((s, r) => s + (Number(r[c]) || 0), 0);
		result.push(subtotal);
		groups.push({ key: currentGroup, rows: groupRows.length });
	}

	// 总计行
	const grandTotal = { _isGrandTotal: true };
	for (const c of groupBy) grandTotal[c] = "合计";
	for (const c of numericCols) grandTotal[c] = sorted.reduce((s, r) => s + (Number(r[c]) || 0), 0);
	result.push(grandTotal);

	return { columns, rows: result, groups };
}

/**
 * 多级表头推断：根据 groupBy 字段分组构建 header 树。
 *
 * 例如 columns = ["部门", "季度", "销售额", "成本"], groupBy = ["部门", "季度"]
 * → 顶层 "部门" → 子 "季度" → 子 "销售额"/"成本"
 */
export function inferHeaderTree(columns, groupBy = []) {
	if (groupBy.length === 0) {
		return columns.map(c => ({ title: c, colspan: 1, children: null }));
	}
	const groupSet = new Set(groupBy);
	const leafCols = columns.filter(c => !groupSet.has(c));

	// 第一层：groupBy[0] → groupBy[1] ... → leaf cols
	function build(remainingGroups, leafCols) {
		if (remainingGroups.length === 0) {
			return leafCols.map(c => ({ title: c, colspan: 1, children: null }));
		}
		const [head, ...tail] = remainingGroups;
		return [{
			title: head,
			colspan: 1, // 分组头本身占 1 列
			children: build(tail, leafCols),
		}];
	}

	const tree = build(groupBy, leafCols);
	return tree.flat();
}

/** 参数化 SQL 执行（副作用：调 dbx-mcp）。 */
export async function executeReportSql(params: { sql: string; parameters?: { name: string; default?: unknown }[]; values?: Record<string, unknown>; connectionId: string; groups?: string[] }) {
	const { sql, parameters = [], values = {}, connectionId, groups = [] } = params;

	// 1. 参数替换
	let resolvedSql = sql;
	const resolvedValues: unknown[] = [];
	const placeholders = resolvedSql.match(/\?/g) ?? [];
	for (let i = 0; i < placeholders.length; i++) {
		const p = parameters[i];
		const val = p ? (values[p.name] ?? p.default) : values[Object.keys(values)[i]];
		resolvedValues.push(val);
	}
	resolvedSql = resolvedSql.replace(/\?/g, () => {
		const v = resolvedValues.shift();
		if (v === null || v === undefined) return "NULL";
		if (typeof v === "number") return String(v);
		if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
		return `'${String(v).replace(/'/g, "''")}'`;
	});

	// 2. SQL 安全检查（sql-safety 模块提供 classifyQuery，返回 { kind, kinds, requiresConfirmation }）
	const { classifyQuery } = await import("./sql-safety.ts");
	const safety = classifyQuery(resolvedSql);
	if (safety.kind === "ddl" || safety.kind === "write") {
		throw new Error(`SQL 安全检查未通过：该报表包含 ${safety.kind} 语句`);
	}

	// 3. 执行（调用方传 connectionId → 这里暂时保留接口）
	const { getDbxMcpClient } = await import("./dbx-mcp-client.ts");
	const client = getDbxMcpClient(undefined);
	const result = await client.callTool("dbx_execute_query", { connection_name: connectionId, sql: resolvedSql, max_rows: 1000 });

	// 4. 解析 + 分组
	const { textOf, parseMarkdownTable } = await import("./markdown-parser.ts");
	if ((result as { isError?: boolean }).isError) throw new Error(textOf(result));
	const { columns, rows } = parseMarkdownTable(textOf(result));
	const grouped = groups.length > 0 ? execReport({ columns, rows: rows as Record<string, unknown>[], options: { groupBy: groups } }) : { columns, rows, groups: [] };

	return { columns: grouped.columns, rows: grouped.rows, groups: grouped.groups, sql: resolvedSql };
}
