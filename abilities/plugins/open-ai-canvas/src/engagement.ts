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

/** The line the host merges into the outgoing turn while the chip is on. */
export function canvasInstruction(serviceId: string): string {
	return [
		"The user attached the Open AI Canvas to this turn.",
		`Canvas operations go through the \`${serviceId}\` MCP server (tools for projects, canvases, nodes and generation tasks).`,
		"Read the current project/canvas before changing it, and describe what you changed in one sentence afterwards.",
		"Never invent node ids or canvas ids: list them first, then act.",
	].join(" ");
}
