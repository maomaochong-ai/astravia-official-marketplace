/**
 * REA 6 阶段逆向工作流元数据 —— 从上游 SKILL.md 提炼的「原理 / 要点 / 引用 / 兜底」。
 *
 * 阶段编号（1-based, 0 索引由组件层处理）：
 *   1. connect   探测 → 失败模式 → 兜底（read-only 物理探测）
 *   2. route     把 22 个上游目标类型聚成 6 个入口（javascript / dotnet / native / firmware / web / mobile）
 *   3. summary   把分散发现翻成 5 字段报告（who/where/what/why/evidence）
 *   4. plan      8 步循环计划（确认→请求→穷尽→记录→重启→补漏→证据→询问）
 *   5. read      5 份 references 按需加载（连接 / 原生 / JS / Android / 运行时 / 证据）
 *   6. finish    5 步交付清单（3 摘要 / 责任链 / 引用留痕 / 失败表 / 兜底）
 *
 * 每条要点带一个 `binding`：它该从哪条真实信号点亮（见 live/diagram-live.ts）。
 * 没有绑定、也没有 doctor 信号的要点是纯原则，界面标「说明」，不假装有进度。
 *
 * i18n key 全部走 `tab.stage.<slug>.*` / `tab.detail.<slug>.*` 命名空间。
 */

import type { DiagramBinding } from "../live/diagram-live";

export const TOTAL_STAGES = 6;

export interface StagePoint {
	/** 摘要 i18n key，落在 `tab.detail.<slug>.pointN`。 */
	readonly i18nKey: string;
	/** 展开后的细节 i18n key，落在 `tab.detail.<slug>.pointN.detail`。 */
	readonly detailKey: string;
	/** 由真实工具调用点亮的信号。 */
	readonly binding?: DiagramBinding;
	/** 由插件自动跑的 doctor 报告点亮的信号。 */
	readonly doctorSignal?: boolean;
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
	/** 4 条要点。 */
	readonly points: readonly StagePoint[];
	/** 该阶段 Agent 侧会调用的 REA 工具（用于展示，不在这里执行）。 */
	readonly toolNames: readonly string[];
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

/** 建立二进制/调试会话的工具：它们成功过，说明链路确实通了。 */
const CONNECT_OPENERS: readonly string[] = [
	"open_binary",
	"binary_session",
	"get_navigation_context",
	"start_gdb_session",
	"start_frida_session",
	"open_jeb_project",
	"cutter_command",
];

export const STAGES: readonly StageDefinition[] = [
	{
		index: 1,
		labelKey: "tab.stage.connect.label",
		headingKey: "tab.detail.connect.heading",
		subtitleKey: "tab.detail.connect.subtitle",
		points: [
			{
				i18nKey: "tab.detail.connect.bullet1",
				detailKey: "tab.detail.connect.point1.detail",
				binding: { kind: "tools", tools: CONNECT_OPENERS },
			},
			{
				i18nKey: "tab.detail.connect.bullet2",
				detailKey: "tab.detail.connect.point2.detail",
				doctorSignal: true,
			},
			{
				i18nKey: "tab.detail.connect.bullet3",
				detailKey: "tab.detail.connect.point3.detail",
			},
			{
				i18nKey: "tab.detail.connect.bullet4",
				detailKey: "tab.detail.connect.point4.detail",
			},
		],
		toolNames: CONNECT_OPENERS,
		referencePath: "agent/skills/reverse-engineer-anything/references/connection-and-recovery.md",
		fallbackKey: "tab.detail.connect.fallback",
		diagram: "connect-decision-tree",
	},
	{
		index: 2,
		labelKey: "tab.stage.route.label",
		headingKey: "tab.detail.route.heading",
		subtitleKey: "tab.detail.route.subtitle",
		points: [
			{
				i18nKey: "tab.detail.route.bullet1",
				detailKey: "tab.detail.route.point1.detail",
				binding: { kind: "targets", targets: ["javascript"] },
			},
			{
				i18nKey: "tab.detail.route.bullet2",
				detailKey: "tab.detail.route.point2.detail",
				binding: { kind: "targets", targets: ["mobile", "dotnet", "firmware"] },
			},
			{
				i18nKey: "tab.detail.route.bullet3",
				detailKey: "tab.detail.route.point3.detail",
				binding: { kind: "tools", tools: ["list_browser_targets", "list_electron_targets", "inspect_electron_fuses"] },
			},
			{
				i18nKey: "tab.detail.route.bullet4",
				detailKey: "tab.detail.route.point4.detail",
				binding: {
					kind: "tools",
					tools: ["inspect_packet_capture", "decode_signal_recording", "inspect_web_network_capture"],
				},
			},
		],
		toolNames: [
			"analyze_javascript_application",
			"open_binary",
			"inspect_artifact",
			"inspect_managed_artifact",
			"inspect_android_package",
			"inspect_firmware_regions",
			"list_browser_targets",
			"list_electron_targets",
		],
		fallbackKey: "tab.detail.route.fallback",
		diagram: "route-fan-out",
	},
	{
		index: 3,
		labelKey: "tab.stage.summary.label",
		headingKey: "tab.detail.summary.heading",
		subtitleKey: "tab.detail.summary.subtitle",
		points: [
			{
				i18nKey: "tab.detail.summary.bullet1",
				detailKey: "tab.detail.summary.point1.detail",
				binding: {
					kind: "tools",
					tools: ["inspect_analysis_view", "inspect_artifact", "analyze_javascript_application", "inspect_binary_layout"],
				},
			},
			{
				i18nKey: "tab.detail.summary.bullet2",
				detailKey: "tab.detail.summary.point2.detail",
				binding: { kind: "tools", tools: ["inspect_analysis_view"] },
			},
			{
				i18nKey: "tab.detail.summary.bullet3",
				detailKey: "tab.detail.summary.point3.detail",
			},
			{
				i18nKey: "tab.detail.summary.bullet4",
				detailKey: "tab.detail.summary.point4.detail",
				binding: { kind: "tools", tools: ["export_evidence_bundle", "get_evidence_bundle"] },
			},
		],
		toolNames: ["inspect_analysis_view", "inspect_artifact", "export_evidence_bundle"],
		fallbackKey: "tab.detail.summary.fallback",
		diagram: "summary-five-fields",
	},
	{
		index: 4,
		labelKey: "tab.stage.plan.label",
		headingKey: "tab.detail.plan.heading",
		subtitleKey: "tab.detail.plan.subtitle",
		points: [
			{
				i18nKey: "tab.detail.plan.bullet1",
				detailKey: "tab.detail.plan.point1.detail",
				binding: { kind: "milestone", after: ["read", "finish"] },
			},
			{
				i18nKey: "tab.detail.plan.bullet2",
				detailKey: "tab.detail.plan.point2.detail",
				binding: { kind: "tools", tools: ["open_binary", "binary_session", "get_navigation_context"] },
			},
			{
				i18nKey: "tab.detail.plan.bullet3",
				detailKey: "tab.detail.plan.point3.detail",
				binding: {
					kind: "tools",
					tools: ["correlate_static_and_runtime", "compare_functions", "compare_bundles", "instrument_with_frida"],
				},
			},
			{
				i18nKey: "tab.detail.plan.bullet4",
				detailKey: "tab.detail.plan.point4.detail",
				binding: {
					kind: "tools",
					tools: ["build_reconstruction_obligation_ledger", "list_unknowns", "record_unknown"],
				},
			},
		],
		toolNames: ["build_reconstruction_obligation_ledger", "list_unknowns", "record_unknown"],
		fallbackKey: "tab.detail.plan.fallback",
		diagram: "plan-eight-steps",
	},
	{
		index: 5,
		labelKey: "tab.stage.read.label",
		headingKey: "tab.detail.read.heading",
		subtitleKey: "tab.detail.read.subtitle",
		points: [
			{
				i18nKey: "tab.detail.read.bullet1",
				detailKey: "tab.detail.read.point1.detail",
				binding: { kind: "targets", targets: ["native", "dotnet"] },
			},
			{
				i18nKey: "tab.detail.read.bullet2",
				detailKey: "tab.detail.read.point2.detail",
				binding: { kind: "targets", targets: ["javascript"] },
			},
			{
				i18nKey: "tab.detail.read.bullet3",
				detailKey: "tab.detail.read.point3.detail",
				binding: { kind: "targets", targets: ["mobile"] },
			},
			{
				i18nKey: "tab.detail.read.bullet4",
				detailKey: "tab.detail.read.point4.detail",
				binding: { kind: "stage", stage: "finish" },
			},
		],
		toolNames: ["inspect_analysis_view"],
		referencePath: "agent/skills/reverse-engineer-anything/references/native-and-artifacts.md",
		fallbackKey: "tab.detail.read.fallback",
		diagram: "read-references-routing",
	},
	{
		index: 6,
		labelKey: "tab.stage.finish.label",
		headingKey: "tab.detail.finish.heading",
		subtitleKey: "tab.detail.finish.subtitle",
		points: [
			{
				i18nKey: "tab.detail.finish.bullet1",
				detailKey: "tab.detail.finish.point1.detail",
				binding: { kind: "stage", stage: "finish" },
			},
			{
				i18nKey: "tab.detail.finish.bullet2",
				detailKey: "tab.detail.finish.point2.detail",
			},
			{
				i18nKey: "tab.detail.finish.bullet3",
				detailKey: "tab.detail.finish.point3.detail",
				binding: {
					kind: "tools",
					tools: ["instrument_with_frida", "capture_process_scenario", "trace_native_values", "observe_web_session"],
				},
			},
			{
				i18nKey: "tab.detail.finish.bullet4",
				detailKey: "tab.detail.finish.point4.detail",
				binding: { kind: "tools", tools: ["export_evidence_bundle"] },
			},
		],
		toolNames: ["verify_reconstruction", "list_unknowns", "export_evidence_bundle"],
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
