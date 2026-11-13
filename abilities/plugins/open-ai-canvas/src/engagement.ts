/**
 * Whether the user has put this canvas on the current turn.
 *
 * The composer chip is the only writer. It is what turns "the model may use the canvas
 * MCP tools" into "the model should, and here is what it is looking at" — the same shape
 * the craft family uses, so one plugin's chip behaves like the next.
 *
 * Kept in module scope rather than React state: `decoratePrompt` runs outside the
 * component tree, at send time, and is the only reader that matters.
 */
let engaged = false;

export function setCanvasEngaged(next: boolean): void {
	engaged = next;
}

export function isCanvasEngaged(): boolean {
	return engaged;
}

/** 画布在「能接活」的状态才值得让模型动手；其它阶段只能如实说明。 */
export interface CanvasPromptFacts {
	readonly ready: boolean;
	readonly origin?: string;
	readonly detail?: string;
}

/**
 * The block merged into the outgoing turn while the chip is on.
 *
 * 这里不猜 API：画布的节点能力由 `plugin.json#agent.mcpServers` 提供的
 * `open-ai-canvas` MCP 服务承载，模型自己就能列出工具；提示词只负责三件事——
 * 告诉它这轮该用画布、别把工具缺失当画布不存在、以及动手前先看现状。
 */
export function canvasInstruction(facts: CanvasPromptFacts): string {
	const lines = [
		"The user put Open AI Canvas on this turn. Its tools come from the `open-ai-canvas` MCP server (projects, canvases, nodes, generation tasks) — use them instead of describing what the user could do by hand.",
		facts.ready
			? `The canvas backend is running${facts.origin ? ` at ${facts.origin}` : ""}. The UI is open in the browser next to Astravia; the same state is what your tools read and write.`
			: `The canvas backend is NOT ready yet${facts.detail ? ` (${facts.detail})` : ""}. Start with a status call; if the tools are missing from your roster, say so in one sentence and ask the user to toggle the canvas chip once more rather than inventing results.`,
		"Read before you write: list the current project and canvas, then act. Never invent project, canvas or node ids.",
		"After changing something, state in one sentence what changed and on which canvas.",
	];
	return lines.join(" ");
}
