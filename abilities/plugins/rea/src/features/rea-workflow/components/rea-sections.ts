/**
 * 侧边栏分节表：一个分节 = 一页 = 一块可独立滚动的内容。
 *
 * 分节按「用户此刻要回答的问题」分组，而不是按代码模块：
 *   工作流 —— 我要做什么、走到哪了
 *   分析   —— 目标是谁、Agent 实际做了什么
 *   环境   —— 这台机器缺什么、引擎活着吗
 *
 * 图标用 lucide，图形必须能代表该分节本身（目标=准星、调用=波形）。
 */

export type ReaSection = "workbench" | "guide" | "targets" | "calls" | "toolchain" | "engine";

export type ReaGroupId = "workflow" | "analysis" | "env";

export interface ReaSectionDefinition {
	readonly id: ReaSection;
	readonly labelKey: string;
	readonly icon: string;
}

export interface ReaSectionGroup {
	readonly id: ReaGroupId;
	readonly labelKey: string;
	readonly items: readonly ReaSectionDefinition[];
}

export const REA_SECTION_GROUPS: readonly ReaSectionGroup[] = [
	{
		id: "workflow",
		labelKey: "ui.nav.group.workflow",
		items: [
			{ id: "workbench", labelKey: "ui.nav.workbench", icon: "icon-[lucide--layout-panel-left]" },
			{ id: "guide", labelKey: "ui.nav.guide", icon: "icon-[lucide--book-open]" },
		],
	},
	{
		id: "analysis",
		labelKey: "ui.nav.group.analysis",
		items: [
			{ id: "targets", labelKey: "ui.nav.targets", icon: "icon-[lucide--crosshair]" },
			{ id: "calls", labelKey: "ui.nav.calls", icon: "icon-[lucide--activity]" },
		],
	},
	{
		id: "env",
		labelKey: "ui.nav.group.env",
		items: [
			{ id: "toolchain", labelKey: "ui.nav.toolchain", icon: "icon-[lucide--wrench]" },
			{ id: "engine", labelKey: "ui.nav.engine", icon: "icon-[lucide--server]" },
		],
	},
];

const SECTIONS: readonly ReaSectionDefinition[] = REA_SECTION_GROUPS.flatMap((group) => group.items);

export function sectionDefinition(section: ReaSection): ReaSectionDefinition {
	return SECTIONS.find((item) => item.id === section) ?? SECTIONS[0]!;
}
