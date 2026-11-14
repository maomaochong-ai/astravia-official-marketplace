/**
 * 逐工具渲染：上游 TUI 最显眼的一处「不是通用卡片」。
 *
 * 上游 `internal/render/` 有 24 个渲染器（`registry.go` 分派），每种工具画成自己的样子：
 * 命令显示命令行、补丁显示改哪个文件、看图显示是小图、覆盖显示面与结果色、笔记显示分类……
 * 本插件此前只有一个通用块，于是 35 个工具长得一模一样——这是与上游最大的界面差距
 * （ADR 0009）。
 *
 * 这里用**家族**而不是 24 个复制品：上游的渲染器大多共享同几种形状（一行标题 + 细节 +
 * 状态），差别在图标、颜色、细节行的取法。12 个家族覆盖 35 个工具，未登记的工具落到
 * `generic`（即上游的 `_render_default_tool_widget`）。
 *
 * 纯函数：不碰 DOM、不读状态，方便逐条断言。
 */

export type ToolFamily =
	| "exec"
	| "patch"
	| "image"
	| "session"
	| "scope"
	| "plan"
	| "coverage"
	| "note"
	| "finding"
	| "report"
	| "skill"
	| "browser"
	| "proxy"
	| "think"
	| "generic";

export interface ToolPresentation {
	family: ToolFamily;
	/** 工具名左侧的字形，取自上游（◇ patch / ◇ view image / ● 会话 …）。 */
	glyph: string;
	/** 这一行的标题，替换掉通用的 `→ Using tool <name>`。 */
	title: string;
	/** 强调色：emerald 成功线、amber 进行中、slate 中性、red 失败。 */
	tone: "emerald" | "amber" | "slate" | "blue" | "red";
	/** 是否值得展开原始输出（命令、代理结果、报告正文）。 */
	expandable: boolean;
}

const TABLE: Record<string, Omit<ToolPresentation, "family">> = {
	// 执行：命令原文就是这一行的主体
	strix_exec: { glyph: "▶", title: "exec", tone: "blue", expandable: true },
	strix_shell_sessions: { glyph: "●", title: "sessions", tone: "slate", expandable: false },
	strix_write_stdin: { glyph: "⌨", title: "stdin", tone: "slate", expandable: false },
	strix_kill_session: { glyph: "■", title: "stop session", tone: "slate", expandable: false },
	// 文件：上游 file_edit.go 用 ◇ + "patch"
	strix_patch: { glyph: "◇", title: "patch", tone: "emerald", expandable: true },
	strix_view_image: { glyph: "◇", title: "view image", tone: "emerald", expandable: false },
	// 范围与会话
	strix_scope: { glyph: "◎", title: "scope", tone: "slate", expandable: false },
	strix_sandbox_start: { glyph: "▣", title: "sandbox", tone: "slate", expandable: false },
	strix_sandbox_status: { glyph: "▣", title: "sandbox", tone: "slate", expandable: false },
	strix_sandbox_stop: { glyph: "▣", title: "sandbox stop", tone: "slate", expandable: false },
	strix_environment: { glyph: "▣", title: "environment", tone: "slate", expandable: true },
	strix_mcp: { glyph: "⇄", title: "MCP connections", tone: "slate", expandable: false },
	// 台账：上游 coverage.go / notes.go / todo.go 的颜色语义
	strix_todo_create: { glyph: "☰", title: "plan", tone: "slate", expandable: false },
	strix_todo_update: { glyph: "☰", title: "plan", tone: "slate", expandable: false },
	strix_todo_list: { glyph: "☰", title: "plan", tone: "slate", expandable: false },
	strix_todo_remove: { glyph: "☰", title: "plan removed", tone: "slate", expandable: false },
	strix_coverage_record: { glyph: "▤", title: "coverage", tone: "emerald", expandable: false },
	strix_coverage_update: { glyph: "▤", title: "coverage updated", tone: "amber", expandable: false },
	strix_coverage_list: { glyph: "▤", title: "coverage", tone: "slate", expandable: false },
	strix_note_create: { glyph: "✎", title: "note", tone: "emerald", expandable: false },
	strix_note_update: { glyph: "✎", title: "note updated", tone: "amber", expandable: false },
	strix_note_get: { glyph: "✎", title: "note", tone: "slate", expandable: true },
	strix_note_list: { glyph: "✎", title: "notes", tone: "slate", expandable: false },
	strix_note_delete: { glyph: "✎", title: "note removed", tone: "slate", expandable: false },
	// 发现与报告
	strix_file_finding: { glyph: "⚑", title: "finding", tone: "red", expandable: true },
	strix_update_finding: { glyph: "⚑", title: "finding updated", tone: "amber", expandable: false },
	strix_list_findings: { glyph: "⚑", title: "findings", tone: "slate", expandable: false },
	strix_delete_finding: { glyph: "⚑", title: "finding removed", tone: "slate", expandable: false },
	strix_merge_findings: { glyph: "⚑", title: "findings merged", tone: "slate", expandable: false },
	strix_report: { glyph: "▦", title: "report", tone: "blue", expandable: true },
	strix_threat_model: { glyph: "◈", title: "threat model", tone: "slate", expandable: true },
	// 技能
	strix_list_skills: { glyph: "≡", title: "skills", tone: "slate", expandable: false },
	strix_load_skills: { glyph: "≡", title: "skill loaded", tone: "emerald", expandable: false },
	// 浏览器与代理
	strix_browser: { glyph: "▭", title: "browser", tone: "blue", expandable: true },
	strix_proxy: { glyph: "⇢", title: "proxy", tone: "blue", expandable: true },
	strix_think: { glyph: "…", title: "thinking", tone: "slate", expandable: false },
};

const FAMILY_OF: Record<string, ToolFamily> = {
	strix_exec: "exec",
	strix_shell_sessions: "session",
	strix_write_stdin: "session",
	strix_kill_session: "session",
	strix_patch: "patch",
	strix_view_image: "image",
	strix_scope: "scope",
	strix_sandbox_start: "generic",
	strix_sandbox_status: "generic",
	strix_sandbox_stop: "generic",
	strix_environment: "generic",
	strix_mcp: "generic",
	strix_todo_create: "plan",
	strix_todo_update: "plan",
	strix_todo_list: "plan",
	strix_todo_remove: "plan",
	strix_coverage_record: "coverage",
	strix_coverage_update: "coverage",
	strix_coverage_list: "coverage",
	strix_note_create: "note",
	strix_note_update: "note",
	strix_note_get: "note",
	strix_note_list: "note",
	strix_note_delete: "note",
	strix_file_finding: "finding",
	strix_update_finding: "finding",
	strix_list_findings: "finding",
	strix_delete_finding: "finding",
	strix_merge_findings: "finding",
	strix_report: "report",
	strix_threat_model: "report",
	strix_list_skills: "skill",
	strix_load_skills: "skill",
	strix_browser: "browser",
	strix_proxy: "proxy",
	strix_think: "think",
};

/**
 * 一个工具该怎么画。
 *
 * 未登记的工具得到上游 generic 那一套（`→ Using tool <name>`），也就是说“没为它特制”
 * 这件事是显式可见的，不是悄悄退化。
 */
export function presentTool(toolName: string): ToolPresentation {
	const entry = TABLE[toolName];
	if (!entry) {
		return { family: "generic", glyph: "→", title: toolName, tone: "blue", expandable: true };
	}
	return { family: FAMILY_OF[toolName] ?? "generic", ...entry };
}

/** 这些家族的结果里带“值得看”的内容；其余只显示状态，避免把 JSON 噪音铺满面板。 */
export const EXPANDABLE_FAMILIES: readonly ToolFamily[] = ["exec", "patch", "browser", "proxy", "report"];
