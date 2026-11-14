/**
 * What the panel remembers about one conversation, across tab switches.
 *
 * Two problems this solves, both reported as "the plugin looks broken":
 *
 * 1. **The panel reset to the launch screen** when the user switched to another
 *    conversation and came back. The host unmounts an activity tab with its
 *    conversation, so React state died with it — even though the sandbox, the findings
 *    and the host turn were all still alive. The run was fine; the window was not.
 * 2. **Conversations bled into each other.** The host emits conversation events on one
 *    stream, so a turn in project A must not drive project B's panel.
 *
 * So state is keyed by conversation id and lives outside the component tree (the same
 * shape as `engagement.ts` in the craft family): a remount rehydrates, and a panel only
 * ever reads and writes its own conversation's entry.
 */

import type { McpConnection } from "../../service/mcp-roster";
import type { CoverageOutcome, NoteSummary, SandboxStatus, StrixFinding, TodoItem, TraceEntry } from "../../runtime-contract";

export interface SessionSnapshot {
	phase: "booting" | "setup" | "scanning" | "done";
	trace: TraceEntry[];
	targets: string[];
	sandbox: SandboxStatus;
	findings: StrixFinding[];
	todos: TodoItem[];
	notes: NoteSummary[];
	coverage: CoverageOutcome[];
	/** MCP connections as last reported; empty in host mode, where there is no roster. */
	mcp: McpConnection[];
}

const MAX_SNAPSHOTS = 8;
const snapshots = new Map<string, SessionSnapshot>();

/** Insertion order is the recency order; the oldest entry is dropped past the cap. */
function trim(): void {
	for (const key of snapshots.keys()) {
		if (snapshots.size <= MAX_SNAPSHOTS) return;
		if (key !== snapshots.keys().next().value) break;
		snapshots.delete(key);
	}
}

export function readSnapshot(conversationId: string | null | undefined): SessionSnapshot | undefined {
	return conversationId ? snapshots.get(conversationId) : undefined;
}

export function writeSnapshot(conversationId: string | null | undefined, snapshot: SessionSnapshot): void {
	if (!conversationId) return;
	// Re-insert so the last write is the newest entry for `trim`.
	snapshots.delete(conversationId);
	snapshots.set(conversationId, snapshot);
	trim();
}

export function forgetSnapshot(conversationId: string | null | undefined): void {
	if (conversationId) snapshots.delete(conversationId);
}

/**
 * The conversation a panel belongs to.
 *
 * The id at mount is the scope: a panel opened in conversation A keeps reporting into A
 * even if the host's event stream briefly carries events from B. `undefined` means the
 * host exposed no id, in which case the panel stays scoped to whatever it mounted with
 * rather than accepting every event.
 */
export function belongsTo(mountedConversationId: string | null, currentConversationId: string | null | undefined): boolean {
	if (mountedConversationId === null) return currentConversationId === undefined || currentConversationId === "";
	return mountedConversationId === currentConversationId;
}
