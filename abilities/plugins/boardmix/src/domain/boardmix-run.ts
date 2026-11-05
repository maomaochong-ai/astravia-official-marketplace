import type { BoardmixPhase } from "./boardmix-destinations";

/** 自动化运行记录的落库路径。schema 只加字段不改名（同 ENTRY_STATE_PATH 的约定）。 */
export const RUN_STATE_PATH = "automation/run.json";

export const AUTOMATION_RECIPES = [
	"focus",
	"create",
	"ai-ppt",
	"ai-flowchart",
	"ai-chat",
	"open-url",
] as const;

export type AutomationRecipeId = (typeof AUTOMATION_RECIPES)[number];

export type RunStepKey = "tab" | "navigate" | "settle" | "handoff";

export type RunStatus = "running" | "done" | "failed";

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface AutomationStep {
	key: RunStepKey;
	status: StepStatus;
	/** 机器可读的短标记（`panel-open` / `login-required` / 失败原因），界面按需展示。 */
	detail: string | null;
	at: string | null;
}

export interface AutomationLanding {
	url: string;
	phase: BoardmixPhase;
	seedLevel: number;
}

export interface AutomationRun {
	id: string;
	recipe: AutomationRecipeId;
	/** prompt = 宿主提问时自动跑；tool = 模型显式调用。 */
	reason: "prompt" | "tool";
	status: RunStatus;
	startedAt: string;
	endedAt: string | null;
	steps: AutomationStep[];
	landing: AutomationLanding | null;
	note: string | null;
}

/**
 * 每一步都是真的动作，没有装饰性步骤：开面板 → 导航 → 看落点 →
 * 需要人接手时明确交出去。加一步之前先问它有没有可观测的后果。
 */
const PLAN: Record<AutomationRecipeId, RunStepKey[]> = {
	focus: ["tab", "navigate", "settle"],
	create: ["tab", "navigate", "settle", "handoff"],
	"ai-ppt": ["tab", "navigate", "settle", "handoff"],
	"ai-flowchart": ["tab", "navigate", "settle", "handoff"],
	"ai-chat": ["tab", "navigate", "settle", "handoff"],
	"open-url": ["tab", "navigate", "settle"],
};

export function isAutomationRecipe(value: unknown): value is AutomationRecipeId {
	return typeof value === "string" && (AUTOMATION_RECIPES as readonly string[]).includes(value);
}

export function planFor(recipe: AutomationRecipeId): RunStepKey[] {
	return [...PLAN[recipe]];
}

/** 只有这几条 recipe 的最后一步是「交还给人」，其余跑完就结束。 */
export function handsOffToUser(recipe: AutomationRecipeId): boolean {
	return PLAN[recipe].includes("handoff");
}

export function beginRun(input: {
	recipe: AutomationRecipeId;
	reason: "prompt" | "tool";
	at: string;
	id: string;
}): AutomationRun {
	return {
		id: input.id,
		recipe: input.recipe,
		reason: input.reason,
		status: "running",
		startedAt: input.at,
		endedAt: null,
		steps: planFor(input.recipe).map(key => ({ key, status: "pending", detail: null, at: null })),
		landing: null,
		note: null,
	};
}

/** 纯函数：返回新对象，界面与存储都靠不可变快照判断变化。 */
export function markStep(
	run: AutomationRun,
	key: RunStepKey,
	status: StepStatus,
	detail: string | null = null,
	at: string | null = null,
): AutomationRun {
	return {
		...run,
		steps: run.steps.map(step => (step.key === key ? { ...step, status, detail, at } : step)),
	};
}

export function finishRun(
	run: AutomationRun,
	status: Exclude<RunStatus, "running">,
	note: string | null,
	at: string,
): AutomationRun {
	return { ...run, status, note, endedAt: at };
}

export function withLanding(run: AutomationRun, landing: AutomationLanding | null): AutomationRun {
	return { ...run, landing };
}

const STEP_KEY_SET: readonly string[] = ["tab", "navigate", "settle", "handoff"];

function readStep(value: unknown): AutomationStep | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	if (typeof raw.key !== "string" || !STEP_KEY_SET.includes(raw.key)) return null;
	const status = raw.status;
	if (status !== "pending" && status !== "running" && status !== "done" && status !== "failed" && status !== "skipped") {
		return null;
	}
	return {
		key: raw.key as RunStepKey,
		status,
		detail: typeof raw.detail === "string" && raw.detail.length > 0 ? raw.detail : null,
		at: typeof raw.at === "string" && raw.at.length > 0 ? raw.at : null,
	};
}

function readPhase(value: unknown): BoardmixPhase {
	return value === "login" || value === "workspace" ? value : "unknown";
}
/**
 * 从存储或工具返回体里读一份运行记录。形状不对就是 `null`——
 * 界面宁可什么都不画，也不画一份猜出来的进度。
 */
export function readAutomationRun(value: unknown): AutomationRun | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	if (typeof raw.id !== "string" || !raw.id) return null;
	if (!isAutomationRecipe(raw.recipe)) return null;
	if (raw.reason !== "prompt" && raw.reason !== "tool") return null;
	if (raw.status !== "running" && raw.status !== "done" && raw.status !== "failed") return null;
	if (typeof raw.startedAt !== "string" || !raw.startedAt) return null;
	if (!Array.isArray(raw.steps)) return null;

	const steps: AutomationStep[] = [];
	for (const item of raw.steps) {
		const step = readStep(item);
		if (!step) return null;
		steps.push(step);
	}
	if (steps.length === 0) return null;
	const landingRaw = raw.landing as Record<string, unknown> | null | undefined;
	const landing: AutomationLanding | null =
		landingRaw && typeof landingRaw.url === "string" && typeof landingRaw.seedLevel === "number"
			? {
					url: landingRaw.url,
					phase: readPhase(landingRaw.phase),
					seedLevel: landingRaw.seedLevel,
				}
			: null;

	return {
		id: raw.id,
		recipe: raw.recipe,
		reason: raw.reason,
		status: raw.status,
		startedAt: raw.startedAt,
		endedAt: typeof raw.endedAt === "string" && raw.endedAt.length > 0 ? raw.endedAt : null,
		steps,
		landing,
		note: typeof raw.note === "string" && raw.note.length > 0 ? raw.note : null,
	};
}

/** 同一次运行的两份拷贝按 `startedAt` 取新的；不同运行也按它取新的。 */
export function newerRun(current: AutomationRun | null, candidate: AutomationRun | null): AutomationRun | null {
	if (!candidate) return current;
	if (!current) return candidate;
	if (candidate.startedAt === current.startedAt) return candidate;
	return candidate.startedAt > current.startedAt ? candidate : current;
}

export function newRunId(now: number): string {
	return `run-${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
