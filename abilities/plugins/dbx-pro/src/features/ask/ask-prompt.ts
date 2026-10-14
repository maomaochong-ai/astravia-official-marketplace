/**
 * ask-prompt.ts — 问数的系统提示词、工具定义与快捷提问推荐（纯函数）。
 *
 * 与 ask-answer.ts 是一对：这里写契约，那里校验契约 —— 改 JSON 字段必须两处同改。
 *
 * 提示词里反复强调的两条是刻意的：
 *   1. 「先用 run_sql 看到真实结果，再下结论」—— 模型的算术不可信，结论必须来自数据。
 *   2. 「只读单语句」—— 问数是取数，写操作在引擎侧也会被拒（checkReadOnlySql 双重把关）。
 */

import type { PluginAiChatTool } from "@astravia-org/plugin-sdk";
import type { AskDatasetContext } from "./ask-types.ts";

/** 问数唯一的工具：模型自己写 SQL 取数，插件执行后把真实结果回填。 */
export const ASK_SQL_TOOL: PluginAiChatTool = {
	name: "run_sql",
	description:
		"在当前数据集（数据源）上执行一条只读 SELECT 取数，返回列名、行数与数据样本。需要看真实数据时调用它，不要凭空推断数字。",
	parameters: {
		type: "object",
		properties: {
			sql: {
				type: "string",
				description: "单条只读 SELECT / WITH 查询；不要分号结尾以外的多语句，不要写 INSERT/UPDATE/DELETE/DDL。",
			},
			purpose: {
				type: "string",
				description: "这次取数的目的（一句话），会展示在分析过程里。",
			},
		},
		required: ["sql"],
		additionalProperties: false,
	},
};

/** 最终答案的 JSON 契约（提示词与解析器共用同一份字段名）。 */
export const ASK_JSON_CONTRACT = `{
  "intent": "一句话复述你理解到的分析意图，例如：近 14 天成交额趋势",
  "chartKind": "chart-line | chart-bar | chart-donut | chart-kpi | chart-funnel | chart-table",
  "fields": ["本次用到的字段名"],
  "sql": "最终取数的单条只读 SELECT",
  "findings": "数据发现（1~3 句，必须引用具体数字）",
  "conclusion": "结论（1~2 句）",
  "suggestions": ["下一步建议 1", "下一步建议 2"]
}`;

export interface BuildAskSystemPromptOptions {
	dataset: AskDatasetContext;
	/** 今天（YYYY-MM-DD）—— 注入日期，避免模型用错「近 14 天」的锚点。 */
	today?: string;
}

/** 组装系统提示词：数据集边界 + schema + 输出契约 + 硬规则。 */
export function buildAskSystemPrompt(options: BuildAskSystemPromptOptions): string {
	const { dataset } = options;
	const tables = (dataset.tables ?? []).filter((t) => t.trim().length > 0);
	const lines: string[] = [];
	lines.push("你是 dbx-pro BI 插件里的「智能问数」助手。用户在浏览器/桌面端里看数据，你要把一句话问题变成一个可解释、可复现的取数答案。");
	lines.push("");
	lines.push("【数据集边界】");
	lines.push(`- 数据源（连接名）：${dataset.connectionName}`);
	lines.push(
		tables.length > 0
			? `- 可用的表：${tables.join("、")}`
			: "- 可用的表：未限定，先用工具查看有哪些表（例如查询 information_schema.tables / sqlite_master）。",
	);
	if (dataset.schemaText && dataset.schemaText.trim()) {
		lines.push("- 已知结构：");
		lines.push(dataset.schemaText.trim());
	}
	if (options.today) lines.push(`- 今天的日期：${options.today}`);
	lines.push("");
	lines.push("【工作方式】");
	lines.push("1. 拿不准表结构时，先调用 run_sql 看一眼（例如先 `SELECT * FROM 表 LIMIT 5`）。");
	lines.push("2. 结论必须建立在 run_sql 的真实返回之上：看到结果后再写 findings / conclusion，禁止凭空推断数字。");
	lines.push("3. 只读：只能提交单条 SELECT / WITH，不要写 INSERT / UPDATE / DELETE / DDL，也不要多条语句。");
	lines.push("4. 用户没给时间范围时，默认最近 14 天；没给维度时优先按天聚合。");
	lines.push("5. 最终只输出下面这一个 JSON 对象（可以用 ```json 围栏包裹），不要输出别的解释文字：");
	lines.push(ASK_JSON_CONTRACT);
	lines.push("");
	lines.push("【字段含义】");
	lines.push("- intent：你理解到的意图，供用户核对（用户会看到它，理解错了要能一眼发现）。");
	lines.push("- chartKind：按意图选默认图型 —— 趋势用 chart-line、占比用 chart-donut、排行用 chart-bar、单值用 chart-kpi、转化用 chart-funnel、要逐行明细用 chart-table。");
	lines.push("- sql：最终取数 SQL，插件会用它再取一次数并画图，所以必须能独立执行。");
	lines.push("- findings / conclusion / suggestions：中文，findings 里的数字必须来自真实结果；没有依据时留空字符串，不要编。");
	return lines.join("\n");
}

interface SuggestRule {
	pattern: RegExp;
	questions: string[];
}

const SUGGEST_RULES: SuggestRule[] = [
	{
		pattern: /order|sale|trade|deal|订单|交易|销售|成交/i,
		questions: ["近 14 天每天的成交额趋势", "各渠道成交额占比", "成交额 Top 10 客户"],
	},
	{
		pattern: /user|member|客户|用户|会员/i,
		questions: ["近 30 天每天新增用户数趋势", "各来源渠道新增用户占比", "下单最多的 Top 10 用户"],
	},
	{
		pattern: /product|goods|item|sku|商品|货品/i,
		questions: ["销量 Top 10 商品", "各品类销售额占比", "近 14 天销售额趋势"],
	},
	{
		pattern: /visit|pageview|uv|pv|流量|访问|event|log/i,
		questions: ["近 14 天每天访问量趋势", "访问量 Top 10 页面", "各来源占比"],
	},
];

const GENERIC_QUESTIONS = [
	"这个数据源里有哪些表？各有多少行？",
	"近 14 天每天的数据量趋势",
	"数值最大的前 10 条记录",
	"各主要维度的占比分布",
];

const MAX_SUGGESTIONS = 6;

/**
 * 快捷提问推荐（对齐 Quick BI 的「自定义快捷提问」，但先做零模型的启发式版本）。
 * 表名命中业务语义时给更具体的问法，否则给通用问法；去重后最多 6 条。
 */
export function suggestQuestions(dataset: Pick<AskDatasetContext, "tables">): string[] {
	const out: string[] = [];
	for (const table of dataset.tables ?? []) {
		for (const rule of SUGGEST_RULES) {
			if (!rule.pattern.test(table)) continue;
			for (const question of rule.questions) {
				if (!out.includes(question)) out.push(question);
			}
		}
	}
	for (const question of GENERIC_QUESTIONS) {
		if (!out.includes(question)) out.push(question);
	}
	return out.slice(0, MAX_SUGGESTIONS);
}
