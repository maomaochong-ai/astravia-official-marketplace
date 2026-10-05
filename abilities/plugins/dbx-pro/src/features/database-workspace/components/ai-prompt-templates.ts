/**
 * AI 提示词模板 - 数据分析领域常用提示词
 * 
 * 提供常用的数据分析提示词模板，用户可以选择并快速发送到 AI
 */

export interface PromptTemplate {
	id: string;
	label: string;
	description: string;
	template: string;
}

/**
 * 数据分析常用提示词模板
 */
export const DATA_ANALYSIS_TEMPLATES: PromptTemplate[] = [
	{
		id: "table-structure",
		label: "表结构分析",
		description: "分析表的结构、字段类型、主键、索引等",
		template: "请分析这个表的结构，包括：\n1. 字段列表和数据类型\n2. 主键和唯一约束\n3. 索引情况\n4. 字段注释和用途\n5. 表之间的关系（如果有）",
	},
	{
		id: "data-quality",
		label: "数据质量检查",
		description: "检查数据的质量问题，如空值、重复、异常值等",
		template: "请帮我检查这个表的数据质量：\n1. 各字段的空值比例\n2. 重复数据情况\n3. 异常值检测\n4. 数据格式一致性\n5. 给出数据质量评分和改进建议",
	},
	{
		id: "data-statistics",
		label: "数据统计分析",
		description: "对数据进行统计分析，包括分布、趋势等",
		template: "请对这个表进行统计分析：\n1. 各字段的基本统计信息（计数、均值、中位数、标准差等）\n2. 数据分布情况\n3. 时间趋势分析（如果有时间字段）\n4. 关键指标汇总\n5. 可视化建议",
	},
	{
		id: "data-relationship",
		label: "数据关系分析",
		description: "分析表与表之间的关系和依赖",
		template: "请分析这个表与其他表的关系：\n1. 外键关系\n2. 数据依赖\n3. 关联查询建议\n4. 数据流向\n5. 可能的数据冗余",
	},
	{
		id: "performance-opt",
		label: "性能优化建议",
		description: "分析查询性能并给出优化建议",
		template: "请分析这个表的查询性能：\n1. 当前索引是否合理\n2. 查询慢的原因分析\n3. 索引优化建议\n4. 查询语句优化\n5. 表结构优化建议",
	},
	{
		id: "data-security",
		label: "数据安全评估",
		description: "评估数据的安全性和隐私风险",
		template: "请评估这个表的数据安全：\n1. 敏感字段识别（如身份证、手机号、密码等）\n2. 数据脱敏建议\n3. 访问权限建议\n4. 数据加密建议\n5. 合规性检查",
	},
	{
		id: "business-insight",
		label: "业务洞察分析",
		description: "从业务角度分析数据的价值和洞察",
		template: "请从业务角度分析这个表的数据：\n1. 关键业务指标\n2. 数据反映的业务趋势\n3. 异常业务情况分析\n4. 业务优化建议\n5. 数据驱动的决策建议",
	},
	{
		id: "custom",
		label: "自定义提示词",
		description: "输入自定义的提示词",
		template: "",
	},
];

/**
 * 根据场景获取推荐的提示词模板
 */
export function getRecommendedTemplates(scenario: "table" | "query" | "connection"): PromptTemplate[] {
	switch (scenario) {
		case "table":
			return DATA_ANALYSIS_TEMPLATES.filter(t => 
				["table-structure", "data-quality", "performance-opt"].includes(t.id)
			);
		case "query":
			return DATA_ANALYSIS_TEMPLATES.filter(t => 
				["data-statistics", "business-insight", "data-relationship"].includes(t.id)
			);
		case "connection":
			return DATA_ANALYSIS_TEMPLATES.filter(t => 
				["data-security", "performance-opt", "data-quality"].includes(t.id)
			);
		default:
			return DATA_ANALYSIS_TEMPLATES;
	}
}
