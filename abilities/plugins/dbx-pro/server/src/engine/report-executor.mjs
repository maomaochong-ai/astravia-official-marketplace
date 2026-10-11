/**
 * report-executor —— 报表 SQL 执行 + 参数替换 + 分组聚合。
 *
 * 前端 dbx-report-builder 编译出 SQL 模板 + 参数定义，
 * 这里负责：参数替换 → SQL 安全检查 → 调 dbx MCP 执行 → 分组小计/合计 → 返回 rows。
 *
 * 复用现有 server/engine/ 组件：
 *   sql-safety.mjs   —— SQL 安全检查（select 白名单 / 禁止 DDL / row_limit 截断）
 *   dbx-mcp-client.mjs —— 执行 SQL
 *   sql-pagination.mjs —— 分页
 */

export async function executeReportSql(params) {
	const { sql, parameters = [], values = {}, connectionId, groups = [] } = params;

	// 1. 参数替换：? 占位符 → 实际值
	let resolvedSql = sql;
	const resolvedValues = [];
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

	// 2. SQL 安全检查
	const { checkSqlSafety } = await import("./sql-safety.mjs");
	const safety = checkSqlSafety(resolvedSql);
	if (!safety.ok) {
		throw new Error(`SQL 安全检查失败: ${safety.reason}`);
	}

	// 3. 执行 SQL
	const { executeSql } = await import("./dbx-mcp-client.mjs");
	const result = await executeSql({ connectionId, sql: resolvedSql });

	// 4. 分组聚合（如果有 groups 定义）
	if (groups.length > 0 && result.rows?.length > 0) {
		result.rows = applyGroupTotals(result.rows, result.columns, groups);
	}

	return {
		columns: result.columns,
		rows: result.rows,
		totalRows: result.rows?.length ?? 0,
		sql: resolvedSql,
	};
}

/** 分组小计/合计（简单实现 —— 全量加载后在 JS 层算）。 */
function applyGroupTotals(rows, columns, groups) {
	// 按 groups 排序（让同组的排一起）
	const sorted = [...rows].sort((a, b) => {
		for (const g of groups) {
			const av = String(a[g] ?? "");
			const bv = String(b[g] ?? "");
			if (av !== bv) return av.localeCompare(bv);
		}
		return 0;
	});

	// 数值列（用于合计）
	const numericCols = columns.filter(c =>
		typeof rows[0]?.[c] === "number" || !isNaN(parseFloat(rows[0]?.[c]))
	);

	const result = [];
	let currentGroup = null;
	let groupRows = [];

	for (const row of sorted) {
		const groupKey = groups.map(g => row[g]).join("||");
		if (currentGroup !== null && groupKey !== currentGroup) {
			result.push(...groupRows);
			// 小计行
			const subtotal = {};
			for (const c of groups) subtotal[c] = groupRows[0][c];
			subtotal["_isSubtotal"] = true;
			for (const c of numericCols) subtotal[c] = groupRows.reduce((s, r) => s + (Number(r[c]) || 0), 0);
			result.push(subtotal);
			groupRows = [];
		}
		currentGroup = groupKey;
		groupRows.push(row);
	}
	// 最后一组
	if (groupRows.length > 0) {
		result.push(...groupRows);
		const subtotal = {};
		for (const c of groups) subtotal[c] = groupRows[0][c];
		subtotal["_isSubtotal"] = true;
		for (const c of numericCols) subtotal[c] = groupRows.reduce((s, r) => s + (Number(r[c]) || 0), 0);
		result.push(subtotal);
	}

	// 总计行
	const grandTotal = { _isGrandTotal: true };
	for (const c of groups) grandTotal[c] = "合计";
	for (const c of numericCols) grandTotal[c] = sorted.reduce((s, r) => s + (Number(r[c]) || 0), 0);
	result.push(grandTotal);

	return result;
}
