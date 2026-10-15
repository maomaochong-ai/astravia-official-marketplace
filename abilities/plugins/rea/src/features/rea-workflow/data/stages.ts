/**
 * REA 6 阶段逆向工作流元数据 —— 从上游 SKILL.md 提炼的「原理 / 命令 / 引用 / 兜底」四元组。
 *
 * 阶段编号（1-based, 0 索引由组件层处理）：
 *   1. connect   探测 → 失败模式 → 兜底（read-only 物理探测）
 *   2. route     22 目标类型分流到 4 个子流程（按证据强度聚类）
 *   3. summary   把分散发现翻成 5 字段报告（who/where/what/why/evidence）
 *   4. plan      8 步循环计划（确认→请求→穷尽→记录→重启→补漏→证据→询问）
 *   5. read      5 份 references 按需加载（连接 / 原生 / JS / Android / 运行时 / 证据）
 *   6. finish    5 步交付清单（3 摘要 / 责任链 / 引用留痕 / 失败表 / 兜底）
 *
 * i18n key 全部走 `tab.stage.<slug>.*` / `tab.detail.<slug>.*` 命名空间，
 * 翻译在 locales/{en,zh}.json 的 tab.* 段。
 */

export const TOTAL_STAGES = 6;

export interface StageBullet {
	/** i18n key，落在 `tab.detail.<slug>.bulletN`。 */
	readonly i18nKey: string;
}

export interface StageDefinition {
	/** 阶段索引 1..6，渲染用。 */
	readonly index: number;
	/** i18n key（短标签），`tab.stage.<slug>.label`。 */
	readonly labelKey: string;
	/** 选中阶段 heading，i18n key `tab.detail.<slug>.heading`。 */
	readonly headingKey: string;
	/** 选中阶段副标题，i18n key `tab.detail.<slug>.subtitle`。 */
	readonly subtitleKey: string;
	/** 4 条原理 bullets。 */
	readonly bullets: readonly StageBullet[];
	/** 关键命令（多行文本渲染在 <pre>）。 */
	readonly command: string;
	/** 关联 reference 路径（包内相对，可选）。 */
	readonly referencePath?: string;
	/** 失败兜底文案 i18n key，落在 `tab.detail.<slug>.fallback`。 */
	readonly fallbackKey: string;
	/** 流程图类型：决定哪个 inline SVG 渲染。 */
	readonly diagram: StageDiagram;
}

export type StageDiagram =
	| "connect-decision-tree"
	| "route-fan-out"
	| "summary-five-fields"
	| "plan-eight-steps"
	| "read-references-routing"
	| "finish-checklist";

export const STAGES: readonly StageDefinition[] = [
	{
		index: 1,
		labelKey: "tab.stage.connect.label",
		headingKey: "tab.detail.connect.heading",
		subtitleKey: "tab.detail.connect.subtitle",
		bullets: [
			{ i18nKey: "tab.detail.connect.bullet1" },
			{ i18nKey: "tab.detail.connect.bullet2" },
			{ i18nKey: "tab.detail.connect.bullet3" },
			{ i18nKey: "tab.detail.connect.bullet4" },
		],
		command:
			"rea doctor --json\nrea --version\nrea capabilities --json\nrea --target <kind> --dry-run",
		referencePath: "agent/skills/reverse-engineer-anything/references/connection-and-recovery.md",
		fallbackKey: "tab.detail.connect.fallback",
		diagram: "connect-decision-tree",
	},
	{
		index: 2,
		labelKey: "tab.stage.route.label",
		headingKey: "tab.detail.route.heading",
		subtitleKey: "tab.detail.route.subtitle",
		bullets: [
			{ i18nKey: "tab.detail.route.bullet1" },
			{ i18nKey: "tab.detail.route.bullet2" },
			{ i18nKey: "tab.detail.route.bullet3" },
			{ i18nKey: "tab.detail.route.bullet4" },
		],
		command:
			"rea route --target <kind> --mode <auto|guided|step>\nrea list-targets --json",
		fallbackKey: "tab.detail.route.fallback",
		diagram: "route-fan-out",
	},
	{
		index: 3,
		labelKey: "tab.stage.summary.label",
		headingKey: "tab.detail.summary.heading",
		subtitleKey: "tab.detail.summary.subtitle",
		bullets: [
			{ i18nKey: "tab.detail.summary.bullet1" },
			{ i18nKey: "tab.detail.summary.bullet2" },
			{ i18nKey: "tab.detail.summary.bullet3" },
			{ i18nKey: "tab.detail.summary.bullet4" },
		],
		command:
			"rea summary --target <kind> --format json --output <path>\nrea summary --target <kind> --format markdown",
		fallbackKey: "tab.detail.summary.fallback",
		diagram: "summary-five-fields",
	},
	{
		index: 4,
		labelKey: "tab.stage.plan.label",
		headingKey: "tab.detail.plan.heading",
		subtitleKey: "tab.detail.plan.subtitle",
		bullets: [
			{ i18nKey: "tab.detail.plan.bullet1" },
			{ i18nKey: "tab.detail.plan.bullet2" },
			{ i18nKey: "tab.detail.plan.bullet3" },
			{ i18nKey: "tab.detail.plan.bullet4" },
		],
		command:
			"rea plan --target <kind> --steps 1..8\nrea plan --target <kind> --step confirm --question \"<ask>\"",
		fallbackKey: "tab.detail.plan.fallback",
		diagram: "plan-eight-steps",
	},
	{
		index: 5,
		labelKey: "tab.stage.read.label",
		headingKey: "tab.detail.read.heading",
		subtitleKey: "tab.detail.read.subtitle",
		bullets: [
			{ i18nKey: "tab.detail.read.bullet1" },
			{ i18nKey: "tab.detail.read.bullet2" },
			{ i18nKey: "tab.detail.read.bullet3" },
			{ i18nKey: "tab.detail.read.bullet4" },
		],
		command:
			"rea read --target <kind> --ref connection-and-recovery\nrea read --target <kind> --ref native-and-artifacts",
		referencePath: "agent/skills/reverse-engineer-anything/references/native-and-artifacts.md",
		fallbackKey: "tab.detail.read.fallback",
		diagram: "read-references-routing",
	},
	{
		index: 6,
		labelKey: "tab.stage.finish.label",
		headingKey: "tab.detail.finish.heading",
		subtitleKey: "tab.detail.finish.subtitle",
		bullets: [
			{ i18nKey: "tab.detail.finish.bullet1" },
			{ i18nKey: "tab.detail.finish.bullet2" },
			{ i18nKey: "tab.detail.finish.bullet3" },
			{ i18nKey: "tab.detail.finish.bullet4" },
		],
		command:
			"rea finish --target <kind> --report <path>\nrea finish --target <kind> --handoff --next-steps",
		referencePath: "agent/skills/reverse-engineer-anything/references/evidence-workflows.md",
		fallbackKey: "tab.detail.finish.fallback",
		diagram: "finish-checklist",
	},
] as const;

export function getStage(index: number): StageDefinition {
	const found = STAGES.find((s) => s.index === index);
	if (!found) throw new Error(`Unknown REA workflow stage index: ${index}`);
	return found;
}
