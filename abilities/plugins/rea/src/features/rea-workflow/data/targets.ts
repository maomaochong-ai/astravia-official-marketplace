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
	/** i18n key: tab.target.<kind>.tools（推荐工具栈，3-4 个名词） */
	readonly toolsKey: string;
	/** 跳到哪个阶段（默认 stage 2 = route）。 */
	readonly routeStage: number;
	/** 推荐起点命令 i18n key: tab.target.<kind>.command。 */
	readonly commandKey: string;
	/** 跳到该目标时显示的「目标类型引导」SVG。 */
	readonly diagram:
		| "js-three-paths"
		| "dotnet-managed"
		| "native-three-providers"
		| "firmware-pipeline"
		| "web-traffic"
		| "mobile-stack";
}

export const TARGETS: readonly TargetDefinition[] = [
	{
		kind: "javascript",
		labelKey: "tab.target.javascript.label",
		hintKey: "tab.target.javascript.hint",
		toolsKey: "tab.target.javascript.tools",
		routeStage: 2,
		commandKey: "tab.target.javascript.command",
		diagram: "js-three-paths",
	},
	{
		kind: "dotnet",
		labelKey: "tab.target.dotnet.label",
		hintKey: "tab.target.dotnet.hint",
		toolsKey: "tab.target.dotnet.tools",
		routeStage: 2,
		commandKey: "tab.target.dotnet.command",
		diagram: "dotnet-managed",
	},
	{
		kind: "native",
		labelKey: "tab.target.native.label",
		hintKey: "tab.target.native.hint",
		toolsKey: "tab.target.native.tools",
		routeStage: 2,
		commandKey: "tab.target.native.command",
		diagram: "native-three-providers",
	},
	{
		kind: "firmware",
		labelKey: "tab.target.firmware.label",
		hintKey: "tab.target.firmware.hint",
		toolsKey: "tab.target.firmware.tools",
		routeStage: 2,
		commandKey: "tab.target.firmware.command",
		diagram: "firmware-pipeline",
	},
	{
		kind: "web",
		labelKey: "tab.target.web.label",
		hintKey: "tab.target.web.hint",
		toolsKey: "tab.target.web.tools",
		routeStage: 2,
		commandKey: "tab.target.web.command",
		diagram: "web-traffic",
	},
	{
		kind: "mobile",
		labelKey: "tab.target.mobile.label",
		hintKey: "tab.target.mobile.hint",
		toolsKey: "tab.target.mobile.tools",
		routeStage: 2,
		commandKey: "tab.target.mobile.command",
		diagram: "mobile-stack",
	},
] as const;

export function getTarget(kind: TargetKind): TargetDefinition {
	const found = TARGETS.find((t) => t.kind === kind);
	if (!found) throw new Error(`Unknown REA target kind: ${kind}`);
	return found;
}
