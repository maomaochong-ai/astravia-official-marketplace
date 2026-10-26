/**
 * 暴露给 Agent 的 REA 自检工具。
 *
 * 这里注册的只有"看状态"和"跑自检"两件事；真正的 207 个 REA 工具由 plugin.json 声明的
 * MCP server（`rea mcp`）提供，二者不重叠。
 *
 * 权限：agent.tools.register + agent.toolHandler.execute。
 * 注意用的是 ctx.cliProviders.run（provider 已声明于 plugin.json#providers.cli），
 * 因此不需要 plugin.json#commands 声明，也不额外要 agent.command.run。
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { STAGE_INDEX } from "../features/rea-workflow/live/tool-taxonomy";
import { doctorArgs, reaPackageArgs } from "../features/rea-workflow/live/engine-bridge";
import type { ReaLiveStore } from "../features/rea-workflow/live/session-store";

/** 只在会话/项目场景出现（scope_use 是 fail-closed 的）。 */
const TOOL_SCOPE_USE = ["conversation", "project"] as const;

const DOCTOR_TIMEOUT_MS = 180_000;
const MAX_STDOUT = 6_000;
const MAX_STDERR = 2_000;

function clip(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * 注册 REA 自检工具。
 * @param providerId plugin.json#providers.cli 里声明的 provider id（rea-agents）
 */
export function registerReaWorkflowTools(
	ctx: PluginContext,
	store: ReaLiveStore,
	providerId: string,
): Disposable[] {
	const statusTool = ctx.agent.registerTool<Record<string, unknown>>({
		id: "rea_workflow_status",
		name: "rea_workflow_status",
		label: "%tool.status.label%",
		description: [
			"Report the live state of the REA (reverse-engineering) workflow for the current session:",
			"engine phase, detected target type, which workflow stages have been visited, and the most",
			"recent REA tool calls with their errors.",
			"",
			"Use it to check where you are before deciding the next reverse-engineering step, or to explain",
			"why the REA tools are not returning data.",
			"",
			"Only for this plugin's REA session state. Do NOT use it to run the engine (use rea_engine_doctor)",
			"or to replace the REA workflow stages themselves.",
		].join("\n"),
		parameters: { type: "object", properties: {}, additionalProperties: false },
		scope_use: [...TOOL_SCOPE_USE],
		context: { conversation: "summary" },
		handler: () => {
			const snapshot = store.getSnapshot();
			const stageLines = Object.entries(STAGE_INDEX).map(([stage, index]) => {
				const count = snapshot.stageCallCounts[stage as keyof typeof snapshot.stageCallCounts] ?? 0;
				const mark = snapshot.activeStage === stage ? " <- current" : "";
				return `  ${index}. ${stage}: ${count} call(s)${mark}`;
			});
			const recentCalls = snapshot.calls
				.slice(-8)
				.map((call) => {
					const status = call.endedAt === null ? "running" : call.isError ? "FAILED" : "ok";
					const target = call.targets.length > 0 ? ` [${call.targets.join("/")}]` : "";
					return `  - ${call.toolName}${target} (${status})${call.argsPreview ? ` ${call.argsPreview}` : ""}`;
				});
			const recentErrors = snapshot.errors
				.slice(0, 5)
				.map((error) => `  - ${error.toolName}: ${error.message}`);

			return [
				"REA workflow state",
				`engine: ${snapshot.providerPhase ?? "unknown"}${snapshot.providerMessage ? ` (${snapshot.providerMessage})` : ""}`,
				`detected target: ${snapshot.detectedTarget ?? "not identified yet"}`,
				`stages visited: ${snapshot.visitedStages.length > 0 ? snapshot.visitedStages.join(", ") : "none"}`,
				`tool calls: ${snapshot.callCount}, failures: ${snapshot.errorCount}, turns: ${snapshot.turns}`,
				`currently running: ${snapshot.runningToolNames.length > 0 ? snapshot.runningToolNames.join(", ") : "nothing"}`,
				"per stage:",
				...stageLines,
				recentCalls.length > 0 ? "recent calls:" : "recent calls: none",
				...recentCalls,
				recentErrors.length > 0 ? "recent failures:" : "recent failures: none",
				...recentErrors,
			].join("\n");
		},
	});

	const doctorTool = ctx.agent.registerTool<{ refresh?: boolean }>({
		id: "rea_engine_doctor",
		name: "rea_engine_doctor",
		label: "%tool.doctor.label%",
		description: [
			"Run the official REA engine self-check (`rea-agents doctor --json`) and return its exit code,",
			"stdout and stderr. It verifies the external toolchain the engine depends on (debuggers,",
			"decompilers, adb, browser bridges) and lists what is missing.",
			"",
			"Use it after a REA tool failed with a toolchain error, or when the user asks whether the",
			"reverse-engineering environment is healthy. Pass refresh=true to force a fresh probe instead of",
			"a cached report.",
			"",
			"Only for diagnosing the REA engine. Do NOT use it to inspect a target — pick a REA target tool",
			"(for example open_binary) for that.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				refresh: {
					type: "boolean",
					description: "Force a fresh probe instead of the cached doctor report.",
				},
			},
			additionalProperties: false,
		},
		scope_use: [...TOOL_SCOPE_USE],
		context: { conversation: "summary" },
		timeoutMs: DOCTOR_TIMEOUT_MS + 10_000,
		handler: async (context) => {
			const refresh = context.trigger.input?.refresh === true;
			// 工具直连宿主 API（不经过 tab 的桥接层），所以这里显式带上包名前缀。
			const args = reaPackageArgs(doctorArgs(refresh));
			try {
				const result = await ctx.cliProviders.run(providerId, args, {
					timeoutMs: DOCTOR_TIMEOUT_MS,
				});
				return [
					`exitCode: ${result.exitCode ?? "null"}`,
					"stdout:",
					clip(result.stdout, MAX_STDOUT) || "(empty)",
					"stderr:",
					clip(result.stderr, MAX_STDERR) || "(empty)",
				].join("\n");
			} catch (error) {
				const phase = store.getSnapshot().providerPhase;
				return [
					`doctor 无法执行：${error instanceof Error ? error.message : String(error)}`,
					`REA 引擎当前状态：${phase ?? "unknown"}。`,
					"引擎未就绪时请先等它安装/校验完成（插件会自动重试），或让用户查看面板顶部的引擎状态条。",
				].join("\n");
			}
		},
	});

	return [doctorTool, statusTool];
}
