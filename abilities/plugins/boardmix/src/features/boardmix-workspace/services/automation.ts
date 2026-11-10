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
import { boardmixTab, waitForBoardmixTab, type BoardmixTabHandle } from "./tab-registry";

const DESTINATION_OF: Record<Exclude<AutomationRecipeId, "open-url">, DestinationKey> = {
	focus: "workspace",
	create: "create",
	"ai-ppt": "aiPpt",
	"ai-flowchart": "aiFlowchart",
	"ai-chat": "aiChat",
};

/** 一次挂载尝试等多久；三次是「面板正在起」与「面板根本没来」的分界。 */
const TAB_WAIT_MS = 4_000;
const TAB_TRIES = 3;

interface AttachResult {
	handle: BoardmixTabHandle | null;
	reason: string;
	attempts: number;
}

function offlineNow(): boolean {
	return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * 让面板出现在会话里，并等到句柄挂上。
 *
 * 两个 API 都要调：
 * - `openActivityTab` 是「用户此刻要看它」——标签卡从未开过时由它创建；
 * - `setActivityTabVisible` 是「它该不该在栏里」——`initiallyVisible: false` 之后，
 *   已经存在但被收起或被减号隐藏的标签卡只有它叫得回来。
 *
 * 只调前一个时，第二次及以后的执行会停在 `tab-not-ready`：面板存在，但不在屏上，
 * `<webview>` 不挂载，句柄就永远不注册。重试是给「正在挂载」留时间，不是掩盖死锁。
 *
 * `cwd` 必须显式传：工具 handler 跑在会话上下文里，宿主当前显示的会话未必是同一个。
 */
async function attachPanel(ctx: PluginContext, cwd: string | undefined, waitMs: number): Promise<AttachResult> {
	const existing = boardmixTab();
	if (existing) return { handle: existing, reason: "panel-open", attempts: 0 };

	const target = cwd ? { cwd } : undefined;
	ctx.ui.openActivityTab(ACTIVITY_TAB_ID, { width: "max", ...target });
	ctx.ui.setActivityTabVisible(ACTIVITY_TAB_ID, true, target);

	for (let attempt = 1; attempt <= TAB_TRIES; attempt += 1) {
		const handle = await waitForBoardmixTab(Math.max(waitMs, TAB_WAIT_MS));
		if (handle) return { handle, reason: "panel-open", attempts: attempt };
	}
	return { handle: null, reason: offlineNow() ? "network" : "tab-never-mounted", attempts: TAB_TRIES };
}

export interface AutomationRequest {
	recipe: AutomationRecipeId;
	/** 只有 `open-url` 用它；其余 recipe 的落点由 DESTINATION_OF 决定。 */
	url?: string;
	reason: "prompt" | "tool";
	/** 等标签页挂上句柄的上限。提问时自动跑的路径给得短，别让人等。 */
	waitMs?: number;
	/** 发起这次执行的会话 cwd；两个 tab API 都要靠它才作用于正确的会话。 */
	cwd?: string;
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
	const attached = await attachPanel(ctx, request.cwd, request.waitMs ?? TAB_WAIT_MS);
	if (!attached.handle) {
		await tick("tab", "failed", attached.reason);
		run = finishRun(run, "failed", attached.reason, at());
		await persistAutomationRun(ctx, run);
		return run;
	}
	const handle = attached.handle;
	await tick("tab", "done", attached.attempts > 1 ? `panel-open-after-${attached.attempts}` : "panel-open");

	await tick("navigate", "running");
	const snapshot = await handle.navigate(target.url);
	if (!snapshot.open || snapshot.failure) {
		const offline = offlineNow();
		const reason = offline ? "network" : "page-not-loaded";
		// 死因写在步骤里：note 仍用短键给 stopHint 分流，detail 留给人和模型看。
		await tick("navigate", "failed", offline ? "offline" : (snapshot.failure ?? "no-load-event-in-time"));
		run = finishRun(run, "failed", reason, at());
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

/**
 * 页面已经停在哪个入口之后，模型下一步该走哪条路。
 *
 * 三条路分开写：AI 页要 prompt，创建页要用户点，其余是 DOM 操作。之前只有一句「你能读/点/拍」，
 * 模型到了 AI 页仍然只会说「你自己点火生成」——而那正是插件能替它做的那一步。
 */
function nextMoveAfter(recipe: AutomationRun["recipe"]): string {
	if (recipe === "ai-ppt" || recipe === "ai-flowchart" || recipe === "ai-chat") {
		return (
			"That is the in-page AI. Compose the prompt first (topic, audience, length), then deliver it with " +
			"boardmix_ai_prompt: it writes the text into the AI composer and leaves send to the user unless they " +
			"explicitly asked you to run it — a generation spends their points."
		);
	}
	if (recipe === "create") {
		return (
			"The create entry is open and the next click is the user's. If the board is for a diagram, write the " +
			"Mermaid now and offer boardmix_diagram once they have a board to land it on."
		);
	}
	return (
		"You can read it (boardmix_read), act on it (boardmix_act) and look at it (boardmix_shot); canvas " +
		"shapes are pixels, so a screenshot is the only way to see them and must not be described as data you read."
	);
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
			"Do not call boardmix_open for the same screen.",
			nextMoveAfter(run.recipe),
		].join(" ");
	}

	return [
		`Boardmix automation ran before this turn (recipe "${run.recipe}") and ${run.status === "failed" ? "failed" : "did not finish"}: ${trail}.`,
		`Stopped at ${run.note ?? "an unknown step"}.`,
		"Tell the user which step stopped and what to do about it; do not claim the panel moved.",
	].join(" ");
}
