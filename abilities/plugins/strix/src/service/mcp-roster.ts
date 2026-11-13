/**
 * The MCP connections a run is using, and whether each is still alive.
 *
 * Upstream keeps this as a roster in the report state (`record_mcp_connection_status`)
 * and the TUI docks it as its own panel: one row per server with provider, tool count
 * and a dead flag. Without it a tool call in the trace cannot be attributed, and a
 * server that quietly died looks like the model "forgetting" tools.
 *
 * Collected from the bridge process instead of the sandbox container: the container's
 * MCP clients live in the Python run, and the bridge already talks to it. When the
 * bridge cannot answer, the roster says so rather than showing an empty panel.
 */

export interface McpConnection {
	readonly name: string;
	readonly provider: string;
	readonly toolCount: number;
	readonly dead: boolean;
}

/** What `plugin.json` declares, as the baseline when the run has not reported yet. */
export interface DeclaredServer {
	readonly name: string;
}

function asConnection(raw: unknown): McpConnection | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const value = raw as Record<string, unknown>;
	const name = typeof value.name === "string" ? value.name.trim() : "";
	if (!name) return undefined;
	return {
		name,
		provider: typeof value.provider === "string" ? value.provider : "",
		toolCount: typeof value.tool_count === "number" ? value.tool_count : 0,
		dead: value.dead === true,
	};
}

/**
 * Normalise a roster payload.
 *
 * Accepts either a bare array or `{ connections: [...] }` (the shape a service reports
 * alongside other state), and drops anything without a name — a nameless row cannot be
 * attributed, which is the only thing this panel is for.
 */
export function normalizeRoster(raw: unknown): McpConnection[] {
	const list = Array.isArray(raw)
		? raw
		: raw && typeof raw === "object" && Array.isArray((raw as { connections?: unknown }).connections)
			? ((raw as { connections: unknown[] }).connections)
			: [];
	return list.map(asConnection).filter((entry): entry is McpConnection => entry !== undefined);
}

/**
 * Merge the declared servers with what the run reported: the declaration is what the
 * user configured, the report is what actually connected. A declared server that never
 * reported is shown as `dead: false, toolCount: 0` but marked pending by the caller —
 * inventing a "dead" state for it would claim a failure nobody observed.
 */
export function mergeRoster(declared: readonly DeclaredServer[], reported: readonly McpConnection[]): McpConnection[] {
	const byName = new Map(reported.map((entry) => [entry.name, entry]));
	const merged: McpConnection[] = [];
	for (const server of declared) {
		merged.push(byName.get(server.name) ?? { name: server.name, provider: "declared", toolCount: 0, dead: false });
		byName.delete(server.name);
	}
	// Servers the run connected but the manifest does not declare still belong here:
	// they are the ones most likely to be misconfigured.
	for (const extra of byName.values()) merged.push(extra);
	return merged;
}

/** One line per connection, for the model and for the panel's tooltip. */
export function describeRoster(connections: readonly McpConnection[]): string {
	if (connections.length === 0) return "no MCP connections";
	return connections
		.map((entry) => `${entry.name}${entry.provider ? ` (${entry.provider})` : ""}: ${entry.toolCount} tools${entry.dead ? ", DEAD" : ""}`)
		.join("\n");
}
