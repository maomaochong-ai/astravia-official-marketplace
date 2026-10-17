/**
 * REA 支持的逆向目标类型 + 路由建议。
 *
 * 来源：上游 morluto/rea docs/*（22 个目标类型聚成 6 个入口）：
 *   1. JavaScript / Electron  → bbbuddy / bytenode / Electron fuses / 进程注入
 *   2. .NET / Managed         → dnlib / ILSpy / Mono.Cecil / Harmony 反射
 *   3. Native / Artifacts     → Hopper / Ghidra / IDA / cutter / Frida
 *   4. Firmware               → binwalk / yara / Ghidra
 *   5. Web / Network          → mitmproxy / Wireshark / HTTP/3 / 浏览器 DevTools
 *   6. Mobile                 → jadx / apktool / adb / frida
 *
 * 每个目标在 tab 顶部以 chip 形式呈现；点击 chip 让 strip 跳到 stage 2（route），
 * 阶段详情区用该目标的子路径文案提示「推荐工具栈」。
 */

export const TOTAL_TARGETS = 6;

export type TargetKind =
	| "javascript"
	| "dotnet"
	| "native"
	| "firmware"
	| "web"
	| "mobile";

export interface TargetDefinition {
	readonly kind: TargetKind;
	/** i18n key: tab.target.<kind>.label */
	readonly labelKey: string;
	/** i18n key: tab.target.<kind>.hint（一句话） */
	readonly hintKey: string;
	/**
	 * 这个目标在 Route 阶段的第一把刀（上游 SKILL.md「Route the target first」列的入口工具）。
	 * 面板用它标注「Agent 会先调什么」，并写进交给 Agent 的提示词。
	 */
	readonly entryTool: string;
	/** i18n key: tab.target.<kind>.firstMove（第一步看什么） */
	readonly firstMoveKey: string;
	/** 跳到哪个阶段（当前所有目标都跳到 stage 2 = route；预留字段以便未来扩展）。 */
	readonly routeStage: 2;
}

export const TARGETS: readonly TargetDefinition[] = [
	{
		kind: "javascript",
		labelKey: "tab.target.javascript.label",
		hintKey: "tab.target.javascript.hint",
		entryTool: "analyze_javascript_application",
		firstMoveKey: "tab.target.javascript.firstMove",
		routeStage: 2,
	},
	{
		kind: "dotnet",
		labelKey: "tab.target.dotnet.label",
		hintKey: "tab.target.dotnet.hint",
		entryTool: "inspect_managed_artifact",
		firstMoveKey: "tab.target.dotnet.firstMove",
		routeStage: 2,
	},
	{
		kind: "native",
		labelKey: "tab.target.native.label",
		hintKey: "tab.target.native.hint",
		entryTool: "open_binary",
		firstMoveKey: "tab.target.native.firstMove",
		routeStage: 2,
	},
	{
		kind: "firmware",
		labelKey: "tab.target.firmware.label",
		hintKey: "tab.target.firmware.hint",
		entryTool: "inspect_firmware_regions",
		firstMoveKey: "tab.target.firmware.firstMove",
		routeStage: 2,
	},
	{
		kind: "web",
		labelKey: "tab.target.web.label",
		hintKey: "tab.target.web.hint",
		entryTool: "list_browser_targets",
		firstMoveKey: "tab.target.web.firstMove",
		routeStage: 2,
	},
	{
		kind: "mobile",
		labelKey: "tab.target.mobile.label",
		hintKey: "tab.target.mobile.hint",
		entryTool: "inspect_android_package",
		firstMoveKey: "tab.target.mobile.firstMove",
		routeStage: 2,
	},
] as const;

export function getTarget(kind: TargetKind): TargetDefinition {
	const found = TARGETS.find((t) => t.kind === kind);
	if (!found) throw new Error(`Unknown REA target kind: ${kind}`);
	return found;
}
