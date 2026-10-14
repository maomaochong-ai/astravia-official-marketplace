/**
 * ask-types.ts — 问数（ChatBI）的领域类型。
 *
 * 「问数」是 BI 首屏的一条工作流：选数据集 → 用自然语言提问 → 模型自己取数
 * （插件私有工具 run_sql）→ 出结论 + 图 + 数据解读 → 一键落成画布节点图。
 * 对齐阿里云 Quick BI Pro「智能问数」的四步（数据集问数配置 / 问数权限 /
 * 问数会话 / 调优），但只做插件侧能闭环的部分（见 ADR-0002）。
 *
 * 这里只放类型与最薄的常量，不放逻辑：逻辑分别在
 *   ask-chart.ts  意图 → 图型、结果集 → 图表序列
 *   ask-answer.ts 模型文本 → 结构化答案（含坏 JSON 的兜底）
 *   ask-prompt.ts 系统提示词、工具定义、快捷提问推荐
 *   ask-loop.ts   一轮问数的多轮工具调用循环
 */

/** 问数结果能落成的图表类型 —— 与画布节点 kind 同名，落画布时不用再映射。 */
export type AskChartKind =
	| "chart-line"
	| "chart-bar"
	| "chart-donut"
	| "chart-kpi"
	| "chart-funnel"
	| "chart-table";

/** 数据源（连接）+ 可选限定表：问数的上下文边界。 */
export interface AskDatasetContext {
	/** engine 的连接名（engineExecuteByName 的第一个参数）。 */
	connectionName: string;
	/** 可选的表清单；空数组表示「这个数据源下的表都可以」。 */
	tables?: string[];
	/** 已取到的 schema 摘要（表 → 字段），注入系统提示词用。 */
	schemaText?: string;
}

/** 一次取数结果（只保留渲染需要的两样东西）。 */
export interface AskResult {
	columns: string[];
	rows: Array<Record<string, unknown>>;
}

/** 模型按 JSON 契约给出的答案草稿（未经归一/取数）。 */
export interface AskAnswerDraft {
	/** 模型自己复述的分析意图，展示在「分析过程」里。 */
	intent: string;
	/** 模型建议的图型；非法值由 ask-chart 归一。 */
	chartKind: string;
	/** 模型声明用到的字段。 */
	fields: string[];
	/** 最终取数 SQL（插件会自己再执行一次，图来自真实结果）。 */
	sql: string;
	findings: string;
	conclusion: string;
	suggestions: string[];
}

/** 面板渲染用的完整答案。 */
export interface AskAnswer extends AskAnswerDraft {
	chartKind: AskChartKind;
	question: string;
	datasetName: string;
	/** 本轮真实执行过的 SQL（含模型自助取数），按执行顺序，可审计。 */
	sqls: string[];
	/** 最终 SQL 的执行结果；取数失败时为 null，失败原因在 error。 */
	result: AskResult | null;
	error: string | null;
}

/** 会话里的一条消息（面板直接渲染）。 */
export type AskTurn =
	| { id: string; role: "user"; text: string }
	| { id: string; role: "assistant"; answer: AskAnswer }
	| { id: string; role: "error"; text: string };

/**
 * 落画布所需的最小信息：SQL + 图型 + 标题 + 数据源。
 *
 * connectionId 是连接 id、connectionName 是引擎执行用的连接名：画布节点里存 id
 * （属性面板的数据源下拉写的就是 id），而 engineExecuteByName 按 name 执行，
 * 两者相差一个 resolveConnectionName（见 canvas/lib/connection-ref.ts）。
 */
export interface AskDraft {
	question: string;
	title: string;
	sql: string;
	chartKind: AskChartKind;
	connectionName: string;
	/** 引擎连接的 id；面板下拉取不到时省略，落画布时退回 connectionName。 */
	connectionId?: string;
}
