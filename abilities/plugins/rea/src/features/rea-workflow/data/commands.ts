/**
 * 可运行的 REA CLI 命令目录 —— 工作台与阶段详情共用的唯一事实源。
 *
 * 每条命令都取自上游 rea CLI 的真实命令名（src/cliCommandNames.ts：doctor /
 * capabilities / providers / analyze / inspect / inspect-artifact /
 * inspect-managed-artifact / inspect-managed-members / inspect-firmware-regions /
 * inspect-web-network-capture / inspect-android-package / analyze-javascript-application …），
 * 参数形态对齐上游 docs/cli.md 的示例。这里不写 `rea route` / `rea summary` 这类
 * 上游不存在的命令。
 *
 * 目标占位符：`{target}` 会在运行前被工作台输入框里的路径或 URL 替换。
 */

import type { TargetKind } from "./targets";

/** provider 声明为 `npx`，所以每次调用都要带上包名与 `-y`。 */
export const REA_PACKAGE_ARGS: readonly string[] = ["-y", "rea-agents@latest"];

/** provider 声明的可执行文件名，只用于展示可复制的完整命令行。 */
export const REA_EXECUTABLE = "npx";

export const TARGET_TOKEN = "{target}";

export interface ReaCommandDefinition {
	readonly id: string;
	/** i18n key：一句话说明这条命令回答什么问题（`tab.cmd.<id>`）。 */
	readonly labelKey: string;
	/** 去掉 `npx -y rea-agents@latest` 前缀后的参数；可含 `{target}`。 */
	readonly args: readonly string[];
	/** 是否必须先在输入框给出目标路径/URL。 */
	readonly needsTarget: boolean;
	/** 单条命令的超时；大应用图谱分析需要更久。 */
	readonly timeoutMs: number;
}

const PROBE_TIMEOUT_MS = 60_000;
const INSPECT_TIMEOUT_MS = 180_000;
const ANALYZE_TIMEOUT_MS = 10 * 60_000;

/** 目标无关的环境探测：不依赖输入框，任何时候都能跑。 */
export const PROBE_COMMANDS: readonly ReaCommandDefinition[] = [
	{
		id: "doctor",
		labelKey: "tab.cmd.doctor",
		args: ["doctor", "--json"],
		needsTarget: false,
		timeoutMs: PROBE_TIMEOUT_MS,
	},
	{
		id: "capabilities",
		labelKey: "tab.cmd.capabilities",
		args: ["capabilities", "--json"],
		needsTarget: false,
		timeoutMs: PROBE_TIMEOUT_MS,
	},
	{
		id: "providers",
		labelKey: "tab.cmd.providers",
		args: ["providers", "--json"],
		needsTarget: false,
		timeoutMs: PROBE_TIMEOUT_MS,
	},
];

/** 每个目标类型的入口命令：与上游 SKILL.md「Route the target first」一一对应。 */
export const COMMANDS_BY_TARGET: Readonly<Record<TargetKind, readonly ReaCommandDefinition[]>> = {
	javascript: [
		{
			id: "analyze-js",
			labelKey: "tab.cmd.analyzeJs",
			args: ["analyze-javascript-application", TARGET_TOKEN, "--json"],
			needsTarget: true,
			timeoutMs: ANALYZE_TIMEOUT_MS,
		},
		{
			id: "analyze-auto",
			labelKey: "tab.cmd.analyzeAuto",
			args: ["analyze", TARGET_TOKEN, "--json"],
			needsTarget: true,
			timeoutMs: ANALYZE_TIMEOUT_MS,
		},
		{
			id: "inspect-artifact",
			labelKey: "tab.cmd.inspectArtifact",
			args: ["inspect-artifact", TARGET_TOKEN, "--json"],
			needsTarget: true,
			timeoutMs: INSPECT_TIMEOUT_MS,
		},
	],
	dotnet: [
		{
			id: "managed-artifact",
			labelKey: "tab.cmd.managedArtifact",
			args: ["inspect-managed-artifact", TARGET_TOKEN, "--json"],
			needsTarget: true,
			timeoutMs: INSPECT_TIMEOUT_MS,
		},
		{
			id: "managed-members",
			labelKey: "tab.cmd.managedMembers",
			args: ["inspect-managed-members", TARGET_TOKEN, "--json"],
			needsTarget: true,
			timeoutMs: INSPECT_TIMEOUT_MS,
		},
	],
	native: [
		{
			id: "inspect-native",
			labelKey: "tab.cmd.inspectNative",
			args: ["inspect", TARGET_TOKEN, "--json"],
			needsTarget: true,
			timeoutMs: INSPECT_TIMEOUT_MS,
		},
		{
			id: "binary-layout",
			labelKey: "tab.cmd.binaryLayout",
			args: ["inspect-binary-layout", TARGET_TOKEN, "--json"],
			needsTarget: true,
			timeoutMs: INSPECT_TIMEOUT_MS,
		},
		{
			id: "go-binary",
			labelKey: "tab.cmd.goBinary",
			args: ["inspect-go-binary", TARGET_TOKEN, "--json"],
			needsTarget: true,
			timeoutMs: INSPECT_TIMEOUT_MS,
		},
		{
			id: "rust-binary",
			labelKey: "tab.cmd.rustBinary",
			args: ["inspect-rust-binary", TARGET_TOKEN, "--json"],
			needsTarget: true,
			timeoutMs: INSPECT_TIMEOUT_MS,
		},
		{
			id: "analyze-ghidra",
			labelKey: "tab.cmd.analyzeGhidra",
			args: ["analyze", TARGET_TOKEN, "--provider", "ghidra", "--json"],
			needsTarget: true,
			timeoutMs: ANALYZE_TIMEOUT_MS,
		},
	],
	firmware: [
		{
			id: "firmware-regions",
			labelKey: "tab.cmd.firmwareRegions",
			args: ["inspect-firmware-regions", TARGET_TOKEN, "--json"],
			needsTarget: true,
			timeoutMs: INSPECT_TIMEOUT_MS,
		},
	],
	web: [
		{
			id: "web-capture",
			labelKey: "tab.cmd.webCapture",
			args: ["inspect-web-network-capture", TARGET_TOKEN, "har", "--json"],
			needsTarget: true,
			timeoutMs: INSPECT_TIMEOUT_MS,
		},
	],
	mobile: [
		{
			id: "android-package",
			labelKey: "tab.cmd.androidPackage",
			args: ["inspect-android-package", TARGET_TOKEN, "--json"],
			needsTarget: true,
			timeoutMs: INSPECT_TIMEOUT_MS,
		},
		{
			id: "adb-devices",
			labelKey: "tab.cmd.adbDevices",
			args: ["list-adb-devices", "--json"],
			needsTarget: false,
			timeoutMs: PROBE_TIMEOUT_MS,
		},
	],
};

const ALL_TARGET_COMMANDS: readonly ReaCommandDefinition[] = Object.values(COMMANDS_BY_TARGET).flat();

/** 按 id 查命令（阶段详情用 id 引用命令目录）。 */
export function findCommand(id: string): ReaCommandDefinition | null {
	const found = [...PROBE_COMMANDS, ...ALL_TARGET_COMMANDS].find((command) => command.id === id);
	return found ?? null;
}

/** 工作台在某个目标下展示的命令：探测命令 + 该目标的入口命令。 */
export function commandsForTarget(kind: TargetKind | null): readonly ReaCommandDefinition[] {
	return kind ? [...PROBE_COMMANDS, ...COMMANDS_BY_TARGET[kind]] : PROBE_COMMANDS;
}

/** 把 `{target}` 换成真实输入，并补上 provider 的 `npx -y rea-agents@latest` 前缀。 */
export function resolveCommandArgs(command: ReaCommandDefinition, target: string): string[] {
	const trimmed = target.trim();
	return [
		...REA_PACKAGE_ARGS,
		...command.args.map((arg) => (arg === TARGET_TOKEN ? trimmed : arg)),
	];
}

/** 可复制/可显示的完整命令行（未填写目标时保留 `{target}` 占位符）。 */
export function formatCommandLine(command: ReaCommandDefinition, target: string): string {
	const trimmed = target.trim();
	return [REA_EXECUTABLE, ...resolveCommandArgs(command, trimmed || TARGET_TOKEN)].join(" ");
}
