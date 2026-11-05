import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { DestinationKey } from "../../../domain/boardmix-destinations";
import {
	beginRun,
	finishRun,
	handsOffToUser,
	markStep,
	newRunId,
	withLanding,
	type AutomationRecipeId,
	type AutomationRun,
} from "../../../domain/boardmix-run";
import { ACTIVITY_TAB_ID } from "../../../plugin-ids";
import { resolveEntryTarget } from "./entry-target";
import { persistAutomationRun } from "./run-store";
import { boardmixTab, waitForBoardmixTab } from "./tab-registry";

const DESTINATION_OF: Record<Exclude<AutomationRecipeId, "open-url">, DestinationKey> = {
	focus: "workspace",
	create: "create",
	"ai-ppt": "aiPpt",
	"ai-flowchart": "aiFlowchart",
	"ai-chat": "aiChat",
};

export interface AutomationRequest {
	recipe: AutomationRecipeId;
	/** 只有 `open-url` 用它；其余 recipe 的落点由 DESTINATION_OF 决定。 */
	url?: string;
	reason: "prompt" | "tool";
	/** 等标签页挂上句柄的上限。提问时自动跑的路径给得短，别让人等。 */
	waitMs?: number;
}

/**
 * 一条 recipe 的真实执行：确保标签页在 → 过 origin 闸门 → 导航 → 读落点。
 * 每一步都先落库再往下走，所以界面上看到的就是此刻真的发生到哪一步。
 */
export async function runAutomation(ctx: PluginContext, request: AutomationRequest): Promise<AutomationRun> {
	const at = () => new Date().toISOString();
	let run = beginRun({ recipe: request.recipe, reason: request.reason, at: at(), id: newRunId(Date.now()) });
	await persistAutomationRun(ctx, run);

	const tick = async (
		key: Parameters<typeof markStep>[1],
		status: Parameters<typeof markStep>[2],
		detail: string | null = null,
	): Promise<void> => {
		run = markStep(run, key, status, detail, at());
		await persistAutomationRun(ctx, run);
	};

	const target =
		request.recipe === "open-url"
			? resolveEntryTarget({ kind: "url", url: request.url ?? "" })
			: resolveEntryTarget({ kind: "destination", key: DESTINATION_OF[request.recipe] });

	if (!target.ok) {
		await tick("navigate", "failed", target.reason);
		run = finishRun(run, "failed", target.reason, at());
		await persistAutomationRun(ctx, run);
		return run;
	}

	await tick("tab", "running");
	let handle = boardmixTab();
	if (!handle) {
		ctx.ui.openActivityTab(ACTIVITY_TAB_ID, { width: "max" });
		handle = await waitForBoardmixTab(request.waitMs ?? 5000);
	}
	if (!handle) {
		await tick("tab", "failed", "tab-not-ready");
		run = finishRun(run, "failed", "tab-not-ready", at());
		await persistAutomationRun(ctx, run);
		return run;
	}
	await tick("tab", "done", "panel-open");

	await tick("navigate", "running");
	const snapshot = await handle.navigate(target.url);
	if (!snapshot.open) {
		await tick("navigate", "failed", "tab-not-ready");
		run = finishRun(run, "failed", "tab-not-ready", at());
		await persistAutomationRun(ctx, run);
		return run;
	}
	await tick("navigate", "done", snapshot.url);
	run = withLanding(run, { url: snapshot.url, phase: snapshot.phase, seedLevel: snapshot.seedLevel });

	if (snapshot.phase === "login") {
		await tick("settle", "done", "login-required");
	} else {
		await tick("settle", "done", snapshot.phase);
	}
	if (handsOffToUser(request.recipe)) await tick("handoff", "done", "user-action");

	run = finishRun(run, "done", snapshot.phase === "login" ? "login-required" : null, at());
	await persistAutomationRun(ctx, run);
	return run;
}

/** 会话上下文里只放事实：面板此刻在哪、模型不该再重复做什么。 */
export function describeRunForModel(run: AutomationRun): string {
	const trail = run.steps.map(step => `${step.key}:${step.status}${step.detail ? `(${step.detail})` : ""}`).join(" -> ");
	const landing = run.landing
		? `${run.landing.url} (phase ${run.landing.phase})`
		: "no landing recorded";

	if (run.status === "done") {
		return [
			`Boardmix automation already ran before this turn (recipe "${run.recipe}", steps ${trail}).`,
			`The Boardmix panel is showing ${landing}.`,
			"Do not call boardmix_open for the same screen. You still cannot read, click, draw on or export the canvas —",
			"tell the user the address and the single click that is left.",
		].join(" ");
	}

	return [
		`Boardmix automation ran before this turn (recipe "${run.recipe}") and ${run.status === "failed" ? "failed" : "did not finish"}: ${trail}.`,
		`Stopped at ${run.note ?? "an unknown step"}.`,
		"Tell the user which step stopped and what to do about it; do not claim the panel moved.",
	].join(" ");
}
