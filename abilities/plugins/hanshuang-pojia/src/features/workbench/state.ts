/**
 * 工作台的页面与状态类型。放在 bridge / hooks / 组件之间共享，
 * 不含任何宿主类型，测试可以直接构造。
 */

import type { ReportMode, TriageReport } from "../../domain/report/report";

export type PageId = "overview" | "guide" | "docs" | "samples" | "findings" | "strings" | "disasm" | "manifest" | "entropy" | "signature" | "compare" | "selfcheck" | "reports" | "settings" | "activity" | "stream" | "prompts";

export interface NavItem {
	id: PageId;
	/** 图标名，见 components/shell/icon-paths.ts；导航一律用 nav-* 前缀的 solar bold。 */
	icon: string;
}

export interface NavGroup {
	/** locales 键后缀，如 nav.group.workflow。 */
	id: string;
	items: readonly NavItem[];
}

export const NAV: readonly NavGroup[] = [
	{ id: "workflow", items: [{ id: "overview", icon: "nav-overview" }, { id: "guide", icon: "nav-guide" }, { id: "docs", icon: "nav-docs" }, { id: "activity", icon: "nav-activity" }, { id: "stream", icon: "nav-stream" }, { id: "prompts", icon: "nav-prompts" }] },
	{ id: "analysis", items: [{ id: "samples", icon: "nav-samples" }, { id: "findings", icon: "nav-findings" }, { id: "strings", icon: "nav-strings" }, { id: "disasm", icon: "nav-disasm" }] },
	{
		id: "forensics",
		items: [
			{ id: "manifest", icon: "nav-manifest" },
			{ id: "entropy", icon: "nav-entropy" },
			{ id: "signature", icon: "nav-signature" },
			{ id: "compare", icon: "nav-compare" },
		],
	},
	{
		id: "system",
		items: [
			{ id: "selfcheck", icon: "nav-selfcheck" },
			{ id: "reports", icon: "nav-reports" },
			{ id: "settings", icon: "nav-settings" },
		],
	},
];

export const PAGES: readonly PageId[] = NAV.flatMap(group => group.items.map(item => item.id));

/** 宿主给了会话状态之后面板顶栏要显示的三态。 */
export type ChatStatus = "disconnected" | "idle" | "streaming";

export interface ChatState {
	status: ChatStatus;
	/** 正在跑的插件工具名（triage_binary 等），null 表示对话没在动插件。 */
	tool: string | null;
	cwd: string | null;
}

export type ChatOutcome = "sent" | "queued" | "opened";

export interface WorkbenchSettings {
	mode: ReportMode;
	/** 用户关掉的规则 id：评分、列表、导出都不再包含。 */
	disabledRules: string[];
	stringsMinLength: number;
	stringsLimit: number;
	entropyBuckets: number;
	/** 关掉后样本库只在本次会话存在，不写宿主私有存储。 */
	persistLibrary: boolean;
}

export const DEFAULT_SETTINGS: WorkbenchSettings = {
	mode: "summary",
	disabledRules: [],
	stringsMinLength: 5,
	stringsLimit: 400,
	entropyBuckets: 25,
	persistLibrary: true,
};

/** 样本库条目：持久化只存摘要，完整报告留在本次会话内存里。 */
export interface LibraryEntry {
	id: string;
	name: string;
	path: string;
	format: string;
	formatLabel: string;
	size: number;
	sha256: string;
	score: number;
	grade: string;
	findings: number;
	analysedAt: string;
}

export const MAX_LIBRARY = 40;

export function libraryId(sha256: string, size: number): string {
	return `${sha256.slice(0, 16)}-${size}`;
}

export function entryFromReport(report: TriageReport): LibraryEntry {
	return {
		id: libraryId(report.target.sha256, report.target.size),
		name: report.target.name,
		path: report.target.path,
		format: report.target.format,
		formatLabel: report.target.formatLabel,
		size: report.target.size,
		sha256: report.target.sha256,
		score: report.risk.score,
		grade: report.risk.grade,
		findings: report.findings.length,
		analysedAt: report.target.generatedAt,
	};
}

export const LIBRARY_STATE_PATH = "workbench/library.json";
export const SETTINGS_STATE_PATH = "workbench/settings.json";

/** 一条工具结果在面板里的展示条目：由 publishToolResult / triage 报告收敛而来。 */
export interface ActivityEntry {
	/** 稳定 id，用来在持久化里去重、在列表里定位。 */
	id: string;
	/** 工具名，如 scan_strings / run_radare。 */
	toolId: string;
	/** 结果种类。 */
	kind: "report" | "strings" | "symbols" | "disasm" | "decompile" | "diff" | "signature" | "checklist" | "probe" | "docs" | "hook" | "protocol" | "other";
	/** 目标样本 / 主题。 */
	target?: string;
	/** 一行可读摘要。 */
	summary: string;
	/** 结构化载荷，面板按 kind 决定渲染方式。 */
	payload?: Record<string, unknown>;
	/** 触发时间。 */
	at: string;
}

export const ACTIVITY_STATE_PATH = "workbench/activity.json";
/** 活动流最多保留多少条；环形截断，保留最近的。 */
export const MAX_ACTIVITY = 200;

/** 一条任务实时流事件（会话 / turn / 工具调用生命周期），由宿主方向 publish 而来。 */
export interface TaskStreamEntry {
	id: string;
	phase: "conversation" | "turn-start" | "turn-end" | "tool-start" | "tool-end";
	sessionId: string | null;
	toolName?: string;
	isError?: boolean;
	streaming?: boolean;
	summary: string;
	at: string;
}

/** 实时流保留的事件条数；它比结果流轻、更“当下”，同样环形截断。 */
export const MAX_TASKS = 80;
