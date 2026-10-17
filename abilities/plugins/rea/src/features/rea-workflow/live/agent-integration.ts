/**
 * 让 Agent 知道 REA 引擎现在能不能用，并在引擎恢复后自动把中断的逆向流程接回去。
 *
 * 三块拼图：
 * 1. systemPrompt provider（每轮开头求值一次）：ready 时提示按 REA 工作流走；
 *    failed / disabled 时明确"别停摆"——先做能做的部分，把待补的逆向步骤记成 unknown。
 * 2. continuation provider（只在 Agent 自然停下时被问）：引擎恢复后注入一次续跑指令，
 *    idempotencyKey 保证同一会话只补一次，不会反复催。
 * 3. 工具（src/tools）让 Agent 自己也能查状态、跑 doctor。
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import type { ReaLiveStore } from "./session-store";

const READY_BLOCK = [
	"## REA engine",
	"The REA engine is available (`rea_workflow_status` for a live view).",
	"When the user asks to reverse engineer an executable, bundle, assembly, firmware image or website,",
	"work the reverse-engineer-anything skill workflow: connect, route to the target type, summarize the",
	"evidence, plan the reconstruction, read the artifacts, then finish by verifying what is still unknown.",
].join("\n");

const DEGRADED_BLOCK = [
	"## REA engine unavailable",
	"The REA engine (the `rea-agents` CLI provider) is not usable right now, so `mcp_plugin-rea-rea_*` tools will fail.",
	"Do NOT stall, retry in a loop, or ask the user to install anything by hand — the plugin notifies them and",
	"retries the engine on its own.",
	"- Do the parts of the request that do not need REA, and say plainly which results are missing.",
	"- Record each reverse-engineering step you could not perform as an unknown / open item with the target path,",
	"  so it can be completed as soon as the engine recovers.",
	"- Never present an unverified claim as evidence-backed.",
].join("\n");

export interface ReaAgentIntegrationHandle extends Disposable {
	/** 测试或 UI 用：当前提示块状态。 */
	engineState(): "ready" | "degraded" | "pending";
}

export function activateReaAgentIntegration(
	ctx: PluginContext,
	store: ReaLiveStore,
): ReaAgentIntegrationHandle {
	const promptProvider = ctx.agent.registerSystemPromptProvider({
		id: "rea.engine-state",
		context: { systemPrompt: "none" },
		handler: () => {
			const phase = store.getSnapshot().providerPhase;
			if (phase === "ready") {
				return [
					{
						type: "addBlock" as const,
						block: { id: "rea-engine-ready", content: READY_BLOCK, priority: 40, enabled: true },
					},
				];
			}
			if (phase === "failed" || phase === "disabled") {
				return [
					{
						type: "addBlock" as const,
						block: { id: "rea-engine-degraded", content: DEGRADED_BLOCK, priority: 60, enabled: true },
					},
				];
			}
			return [];
		},
	});

	const continuationProvider = ctx.agent.registerContinuationProvider({
		id: "rea.engine-recovery",
		context: { conversation: "summary" },
		handler: () => {
			const recoveredAt = store.peekRecoveryNotice();
			if (recoveredAt === null) return null;
			const { sessionId } = store.getSnapshot();
			// 只为本会话自身的引擎中断续跑：换过会话、或本会话根本没调过 REA，
			// 都不能拿一句话打断用户当前的话题。
			if (!store.recoveryAppliesTo(sessionId) || store.sessionCallCount() === 0) {
				store.consumeRecoveryNotice();
				return null;
			}
			store.consumeRecoveryNotice();
			return {
				text: [
					"The REA engine recovered and is ready again.",
					"Resume the reverse-engineering steps that were left as pending unknowns, then continue the original task.",
				].join(" "),
				idempotencyKey: `rea-engine-recovered-${recoveredAt}`,
			};
		},
	});

	return {
		engineState: () => {
			const phase = store.getSnapshot().providerPhase;
			if (phase === "ready") return "ready";
			if (phase === "failed" || phase === "disabled") return "degraded";
			return "pending";
		},
		dispose: (): void => {
			continuationProvider.dispose();
			promptProvider.dispose();
		},
	};
}
