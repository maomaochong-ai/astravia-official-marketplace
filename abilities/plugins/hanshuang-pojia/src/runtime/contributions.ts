import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import type { ConversationScenario, Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { KERNEL_BLOCK_ID, KERNEL_PRIORITY, buildKernelBlock } from "../domain/kernel";
import { LAB_OFF, parseLabCommand, type LabState } from "../domain/lab-mode";
import { LAB_STATE_PATH } from "../features/workbench/hooks/use-lab";
import { SYSTEM_PROMPT_BLOCK_ID, SYSTEM_PROMPT_BODY, SYSTEM_PROMPT_PRIORITY } from "../domain/system-prompt.generated";
import { planRecovery } from "../domain/refusal";
import { TOOL_IDS } from "../tools/ids";
import { getAgentPage } from "./panel-channel";

/** 插件声明的会话场景；与工具、活动面板保持一致。 */
export const SCENARIOS: readonly ConversationScenario[] = ["conversation", "project"];

async function readLab(ctx: PluginContext): Promise<LabState> {
	try {
		const stored = await readJsonFile<LabState>(ctx.storage, LAB_STATE_PATH);
		return stored?.enabled ? { enabled: true, since: stored.since ?? null } : LAB_OFF;
	} catch {
		// 没有 storage 授权：按关闭处理，不让提示词层因读盘失败而消失。
		return LAB_OFF;
	}
}

async function writeLab(ctx: PluginContext, state: LabState): Promise<void> {
	try {
		await writeJsonFile(ctx.storage, LAB_STATE_PATH, state);
	} catch (error) {
		console.warn("[hanshuang-pojia] lab state not persisted", error);
	}
}

/**
 * 运行时贡献：动态系统提示块 + 输入开关 hook + 回合边界恢复 hook。
 *
 * 为什么走这三条而不是加静态文件：
 * - 「实验室开没开、用户在看哪一页」是**每轮会变**的状态，静态文件表达不了；
 * - `lab：` 前缀需要在用户发出消息的那一刻改写状态并补一句上下文，
 *   这是 UserPromptSubmit hook 的职责，不是提示词能做的事；
 * - 上游在 provider 请求层注入 `safetySettings` 的做法在这里没有对应钩子（宿主不暴露
 *   请求拦截），所以「停在半路」只能在 Stop 边界上识别并追加一次技术追问。
 *
 * 提示词分两块：
 *   kernel  — 每轮都注入，只放会变的运行时状态（很短）
 *   system  — 只在 lab 开启时注入，放不随回合变化的作战契约（`agent/docs/SYSTEM.md`）
 * 分开的理由是预算：关闭实验环境时不该为一个用不上的契约付 token。
 *
 * 每个贡献单独 try：旧宿主没有这些 API，或用户没授予对应权限时只跳过它。
 */
export function registerRuntimeContributions(ctx: PluginContext): Disposable[] {
	const disposables: Disposable[] = [];

	try {
		disposables.push(
			ctx.agent.registerSystemPromptProvider({
				id: "kernel",
				timeoutMs: 2000,
				handler: async () => {
					const lab = await readLab(ctx);
					const operations: Array<Record<string, unknown>> = [
						{
							type: "addBlock",
							block: {
								id: KERNEL_BLOCK_ID,
								priority: KERNEL_PRIORITY,
								content: buildKernelBlock({
									lab,
									page: getAgentPage(),
									tools: TOOL_IDS,
								}),
							},
						},
					];
					if (lab.enabled) {
						operations.push({
							type: "addBlock",
							block: {
								id: SYSTEM_PROMPT_BLOCK_ID,
								priority: SYSTEM_PROMPT_PRIORITY,
								content: SYSTEM_PROMPT_BODY,
							},
						});
					}
					return operations as never;
				},
			}),
		);
	} catch (error) {
		console.warn("[hanshuang-pojia] system prompt provider unavailable", error);
	}

	try {
		disposables.push(
			ctx.agent.registerHook({
				id: "lab-switch",
				eventName: "UserPromptSubmit",
				scope_use: SCENARIOS,
				timeoutMs: 2000,
				handler: async ({ event }) => {
					const command = parseLabCommand(event.prompt);
					if (command.action === "none") return { action: "continue" as const };

					const current = await readLab(ctx);
					const next: LabState =
						command.action === "enter"
							? { enabled: true, since: current.since ?? new Date().toISOString() }
							: LAB_OFF;
					await writeLab(ctx, next);

					const note =
						command.action === "enter"
							? `Lab mode is now ON for this workspace.${command.rest ? ` Task: ${command.rest}` : ""}`
							: "Lab mode is now OFF. Answer ordinary questions normally.";
					return { action: "continue" as const, additionalContexts: [note] };
				},
			}),
		);
	} catch (error) {
		console.warn("[hanshuang-pojia] lab hook unavailable", error);
	}

	try {
		disposables.push(
			ctx.agent.registerHook({
				id: "turn-recovery",
				eventName: "Stop",
				scope_use: SCENARIOS,
				timeoutMs: 2000,
				handler: async ({ event }) => {
					const lab = await readLab(ctx);
					const outcome = planRecovery(event.lastAssistantMessage, {
						enabled: lab.enabled,
						stopHookActive: event.stopHookActive,
					});
					if (!outcome) return;
					return { action: "continue-agent" as const, continuationFragments: [outcome.fragment] };
				},
			}),
		);
	} catch (error) {
		console.warn("[hanshuang-pojia] turn recovery hook unavailable", error);
	}

	return disposables;
}
