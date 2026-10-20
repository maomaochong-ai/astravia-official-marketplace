/**
 * 工作台的页面与状态类型。放在 bridge / hooks / 组件之间共享，
 * 不含任何宿主类型，测试可以直接构造。
 */

import type { ReportMode, TriageReport } from "../../domain/report/report";

export type PageId = "overview" | "guide" | "samples" | "findings" | "strings" | "manifest" | "entropy" | "signature" | "compare" | "selfcheck" | "reports" | "settings";

export interface NavItem {
	id: PageId;
	/** solar/lucide 风格的图标名，见 components/shell/icon.tsx。 */
	icon: string;
}

export interface NavGroup {
	/** locales 键后缀，如 nav.group.workflow。 */
	id: string;
	items: readonly NavItem[];
}

export const NAV: readonly NavGroup[] = [
	{ id: "workflow", items: [{ id: "overview", icon: "layout" }, { id: "guide", icon: "book" }] },
	{ id: "analysis", items: [{ id: "samples", icon: "boxes" }, { id: "findings", icon: "scan" }, { id: "strings", icon: "type" }] },
	{
		id: "forensics",
		items: [
			{ id: "manifest", icon: "shield" },
			{ id: "entropy", icon: "activity" },
			{ id: "signature", icon: "fingerprint" },
			{ id: "compare", icon: "compare" },
		],
	},
	{
		id: "system",
		items: [
			{ id: "selfcheck", icon: "clipboard" },
			{ id: "reports", icon: "file" },
			{ id: "settings", icon: "settings" },
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
