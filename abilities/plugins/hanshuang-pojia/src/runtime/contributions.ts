import { readJsonFile, writeJsonFile } from "@astravia-org/plugin-sdk";
import type { ConversationScenario, Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { KERNEL_BLOCK_ID, KERNEL_PRIORITY, buildKernelBlock } from "../domain/kernel";
import { LAB_OFF, parseLabCommand, type LabState } from "../domain/lab-mode";
import { LAB_STATE_PATH } from "../features/workbench/hooks/use-lab";
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
 * 运行时贡献：动态系统提示块 + 输入归一化 hook。
 *
 * 为什么走这两条而不是加一个静态文件：
 * - 「实验室开没开、用户在看哪一页」是**每轮会变**的状态，静态文件表达不了；
 * - `lab：` 前缀需要在用户发出消息的那一刻改写状态并补一句上下文，
 *   这是 UserPromptSubmit hook 的职责，不是提示词能做的事。
 *
 * 2.4.0 起包内不再有常驻块：规则本体在技能里按需加载，本文件是唯一的每轮注入通道。
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
					return [
						{
							type: "addBlock" as const,
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

	return disposables;
}