/**
 * 「真实使用案例」：可以直接复制进对话的提示词。
 *
 * 每一条都点名 REA 真实存在的入口工具（见上游 SKILL.md 的 Route the target first），
 * 并且按用户手上的目标类型给出不同的第一步——不是泛泛的「帮我分析一下」。
 *
 * 提示词里的 `{{target}}` 由面板用当前输入框的内容替换；输入框为空时用占位符，
 * 用户粘进对话后自己替换。文案在 locales 里，这里只保留结构与指向。
 */

import type { TargetKind } from "./targets";

export interface UsageExample {
	readonly id: string;
	readonly targetKind: TargetKind;
	/** 这条案例真正会调用的第一个 REA 工具。 */
	readonly tool: string;
	readonly titleKey: string;
	readonly promptKey: string;
}

export const USAGE_EXAMPLES: readonly UsageExample[] = [
	{
		id: "electron",
		targetKind: "javascript",
		tool: "analyze_javascript_application",
		titleKey: "tab.examples.electron.title",
		promptKey: "tab.examples.electron.prompt",
	},
	{
		id: "binary",
		targetKind: "native",
		tool: "open_binary",
		titleKey: "tab.examples.binary.title",
		promptKey: "tab.examples.binary.prompt",
	},
	{
		id: "apk",
		targetKind: "mobile",
		tool: "inspect_android_package",
		titleKey: "tab.examples.apk.title",
		promptKey: "tab.examples.apk.prompt",
	},
	{
		id: "firmware",
		targetKind: "firmware",
		tool: "inspect_firmware_regions",
		titleKey: "tab.examples.firmware.title",
		promptKey: "tab.examples.firmware.prompt",
	},
	{
		id: "capture",
		targetKind: "web",
		tool: "inspect_web_network_capture",
		titleKey: "tab.examples.capture.title",
		promptKey: "tab.examples.capture.prompt",
	},
	{
		id: "pcap",
		targetKind: "firmware",
		tool: "inspect_packet_capture",
		titleKey: "tab.examples.pcap.title",
		promptKey: "tab.examples.pcap.prompt",
	},
];
