/**
 * dbx_explain — SQL 查询分析工具。
 *
 * 通过 EXPLAIN 获取执行计划，分析查询性能并提供优化建议。
 */

import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { engineExecuteByName, type EngineQueryOutcome } from "../shared/services/engine-client";

export interface DbxExplainInput {
	connection_name: string;
	sql: string;
	analyze?: boolean;
}

export function createDbxExplainTool(): PluginAgentToolRegistration<DbxExplainInput> {
	return {
		id: "dbx_explain",
		name: "dbx_explain",
		label: "查询分析",
		description: [
			"Analyze SQL query execution plans and provide optimization suggestions.",
			"Uses EXPLAIN (or EXPLAIN ANALYZE if analyze=true) to get the execution plan.",
			"Returns the plan output and performance insights.",
			"Use this tool when the user asks to optimize a query, understand query performance,",
			"or identify bottlenecks like full table scans, missing indexes, or expensive joins.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				connection_name: {
					type: "string",
					description: "Name of the database connection.",
				},
				sql: {
					type: "string",
					description: "SQL query to analyze.",
				},
				analyze: {
					type: "boolean",
					description: "Set to true to use EXPLAIN ANALYZE (actually executes the query). Default false.",
				},
			},
			required: ["connection_name", "sql"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger: { input } }) => {
			const { connection_name, sql, analyze } = input;

			if (!connection_name || typeof connection_name !== "string") {
				return { ok: false, error: "connection_name is required" };
			}
			if (!sql || typeof sql !== "string") {
				return { ok: false, error: "sql is required" };
			}

			const explainSql = analyze ? `EXPLAIN ANALYZE ${sql}` : `EXPLAIN ${sql}`;

			try {
				const outcome: EngineQueryOutcome = await engineExecuteByName(
					connection_name,
					explainSql,
					{ rowLimit: 100, timeoutMs: 60000 },
				);

				const planLines: string[] = [];
				for (const row of outcome.rows) {
					const line = Object.values(row).map(String).join(" | ");
					planLines.push(line);
				}

				const analysis: string[] = [];
				const planText = planLines.join("\n").toLowerCase();

				if (planText.includes("seq scan") || planText.includes("full table scan")) {
					analysis.push("- 检测到全表扫描（Seq Scan），考虑添加索引以加速查询");
				}
				if (planText.includes("nested loop") && planText.includes("rows=")) {
					analysis.push("- 检测到嵌套循环连接，如果数据量大可考虑优化 JOIN 条件或添加索引");
				}
				if (planText.includes("sort") && planText.includes("external merge")) {
					analysis.push("- 检测到外部排序，考虑增加 work_mem 或优化 ORDER BY 子句");
				}
				if (planText.includes("index scan") || planText.includes("index only scan")) {
					analysis.push("- 已使用索引扫描，查询效率较好");
				}
				if (planText.includes("hash join")) {
					analysis.push("- 使用哈希连接，适合中等大小的表连接");
				}

				return {
					ok: true,
					connection: outcome.connection,
					original_sql: sql,
					explain_sql: explainSql,
					plan: planLines,
					plan_line_count: planLines.length,
					duration_ms: outcome.duration_ms,
					analysis: analysis.length > 0 ? analysis : ["- 执行计划分析完成，未发现明显性能问题"],
					analyze_mode: analyze === true,
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (message.includes("syntax error") || message.includes("EXPLAIN")) {
					return {
						ok: false,
						error: `该数据库类型可能不支持 EXPLAIN 语法：${message}`,
						hint: "请检查数据库类型是否支持 EXPLAIN，或尝试使用 EXPLAIN 的其他变体（如 SHOWPLAN）",
					};
				}
				return { ok: false, error: message };
			}
		},
	};
}
