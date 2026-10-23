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
	"decompile_function",
	"diff_functions",
	"generate_hook",
	"triage_directory",
	"search_docs",
	"read_doc",
	"probe_environment",
	"run_radare",
	"decompile_android",
	"init_task",
	"write_assessment_report",
	"install_toolchain",
	"kb_checklist",
	"kb_payloads",
	"ida_status",
	"verify_signature",
	"frida_dump",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

/**
 * 工具总数的防漂移锚点。自检页用它断言注册表没有在重构里悄悄少一项：
 * 只比 `TOOL_IDS` 自己永远不会失败，必须有一个外部数字。
 */
export const EXPECTED_TOOL_COUNT = 25;

/** 宿主可能给工具名加前缀，所以按后缀 / 包含判定。 */
export function isPluginTool(toolName: string): boolean {
	return TOOL_IDS.some(id => toolName === id || toolName.endsWith(`.${id}`) || toolName.includes(id));
}
