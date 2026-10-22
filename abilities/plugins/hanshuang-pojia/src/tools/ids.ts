/**
 * 插件注册的全部 Agent 工具 id，按注册顺序。
 *
 * 三处消费方必须共用这一份清单，否则会各自漂移：
 * - `register-tools.ts` 用它做注册完整性断言；
 * - `index.tsx` 用它识别「正在跑的是本插件工具」的会话事件；
 * - 自检页 / `scripts/check.mjs` 用它核对工具总数。
 */

export const TOOL_IDS = [
	"triage_binary",
	"scan_binary_strings",
	"explain_triage_finding",
	"export_triage_report",
	"list_code_symbols",
	"disassemble_range",
	"search_dex_symbols",
	"diff_binaries",
	"search_docs",
	"read_doc",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

/** 宿主可能给工具名加前缀，所以按后缀 / 包含判定。 */
export function isPluginTool(toolName: string): boolean {
	return TOOL_IDS.some(id => toolName === id || toolName.endsWith(`.${id}`) || toolName.includes(id));
}
