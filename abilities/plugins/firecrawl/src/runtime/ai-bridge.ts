/**
 * The UI → agent half of the console's two-way link.
 *
 * `sendPrompt` already resolves the three things the host can do with a prompt
 * (send it, queue it behind the running turn, or park it in the input when no
 * session is live), so this module only decides *what* travels with the question.
 * The excerpt is inlined because the agent cannot read plugin storage: whatever it
 * needs to answer has to be in the prompt itself.
 */

import type { CrawlArtifact } from "../domain/firecrawl/artifacts";
import { type PromptOutcome, sendPrompt } from "./conversation-prompt";

export type { PromptOutcome };

/** Long enough to argue about, short enough to leave room for the question. */
const MAX_EXCERPT_CHARS = 1_200;
const MAX_EXCERPT_ITEMS = 20;

/** A bounded, quotable slice of one artifact. */
export function excerptOf(artifact: CrawlArtifact): string {
	if (artifact.text) {
		return artifact.text.length > MAX_EXCERPT_CHARS ? `${artifact.text.slice(0, MAX_EXCERPT_CHARS)}…` : artifact.text;
	}
	const items = artifact.items ?? [];
	if (items.length === 0) return "";
	const shown = items.slice(0, MAX_EXCERPT_ITEMS).join("\n");
	return items.length > MAX_EXCERPT_ITEMS ? `${shown}\n… (+${items.length - MAX_EXCERPT_ITEMS} more)` : shown;
}

export function askAgent(prompt: string): Promise<PromptOutcome> {
	return sendPrompt(prompt);
}
