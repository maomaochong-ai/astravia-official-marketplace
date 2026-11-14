/**
 * Turning two event streams into one transcript.
 *
 * The panel is fed by the host conversation (which tool the agent is calling, what the
 * user typed, what the model is answering) and by the bridge service (the command that
 * actually ran, its exit code, its output tail). Neither alone is a readable trace:
 *
 *  - the host knows *that* `strix_exec` ran but not what it printed;
 *  - the service knows what ran but not which of its calls belong to this conversation.
 *
 * So the split is by owner: a tool whose evidence lives in the service is drawn from the
 * service's feed; every other `strix_*` call is drawn from the host event that names it.
 * `isServiceNarrated` is the single switch, and both sides consult it, which is what keeps
 * one command from appearing twice.
 *
 * Pure functions: no I/O, no React, no host access, so the rules are testable as data.
 */

import type { ConversationMessage } from "@astravia-org/plugin-sdk";
import type { BridgeEvent, TraceEntry } from "../runtime-contract";

/**
 * Tools whose row comes from the service feed.
 *
 * `strix_exec` is the one that carries evidence — command, exit code, duration, output.
 * The rest are metadata calls that finish in milliseconds and whose result the model
 * already restates in its answer; drawing them from the host keeps them in the order the
 * agent actually issued them.
 */
const SERVICE_NARRATED = new Set(["strix_exec"]);

/**
 * The service's internal name for a tool → the name the agent called.
 *
 * The bridge emits `exec_command` for what MCP calls `strix_exec`, and `proxy` / `browser`
 * for the two side doors. Without this translation the finishing event never matched the
 * row the start event opened, and a command stayed "in progress" forever.
 */
const SERVICE_NAMES: Record<string, string> = {
	exec_command: "strix_exec",
	proxy: "strix_proxy",
	browser: "strix_browser",
};

/** The agent-facing name for a service event's tool, or undefined when it is not Strix's. */
export function serviceToolToStrix(tool: string): string | undefined {
	return SERVICE_NAMES[tool] ?? strixToolName(tool);
}

/** True when the service, not the conversation, narrates this tool. */
export function isServiceNarrated(toolName: string): boolean {
	const name = serviceToolToStrix(toolName);
	return name !== undefined && SERVICE_NARRATED.has(name);
}

/**
 * The `strix_*` tool behind whatever namespace the host applied, or undefined.
 *
 * The host prefixes MCP tools (`mcp__strix__strix_exec`), so the comparison has to be
 * made on the last `strix_*` segment rather than the raw name. Returning undefined for a
 * foreign tool is what keeps another MCP server's calls out of this transcript.
 */
export function strixToolName(toolName: string): string | undefined {
	const trimmed = toolName.trim();
	const index = trimmed.toLowerCase().lastIndexOf("strix_");
	if (index < 0) return undefined;
	const candidate = trimmed.slice(index).replace(/_+$/, "");
	return /^strix_[a-z0-9_]+$/i.test(candidate) ? candidate : undefined;
}

/** The argument that says what a call acts on, when it has one. */
function detailOf(args: Record<string, unknown> | undefined): string | undefined {
	const values = args ?? {};
	const pick = (key: string): string | undefined => (typeof values[key] === "string" ? (values[key] as string) : undefined);
	return (
		pick("command") ??
		pick("question") ??
		pick("title") ??
		pick("name") ??
		(Array.isArray(values.targets) ? values.targets.map(String).join(" ") : undefined) ??
		(Array.isArray(values.names) ? values.names.map(String).join(", ") : undefined)
	);
}

/**
 * A tool row from a start event, whichever side saw it start.
 *
 * `strix_exec` arrives as a bridge `tool_start` (which carries the command); other tools
 * arrive as a host `tool-call-start` (which carries the arguments). Both produce the same
 * shape, so the renderer does not care which side it came from — and a tool that is not
 * Strix's produces nothing at all.
 */
export function toolRow(input: {
	tool: string;
	command?: string;
	args?: Record<string, unknown>;
}): Omit<TraceEntry, "id" | "at"> | undefined {
	const label = serviceToolToStrix(input.tool);
	if (!label) return undefined;
	const detail = input.command ?? detailOf(input.args);
	return detail ? { kind: "tool", label, detail } : { kind: "tool", label };
}

/** What the service adds when the command finishes: verdict, timing, output. */
export function evidenceRow(
	event: Extract<BridgeEvent, { event: "tool_end" }>,
): { patch: Partial<TraceEntry> } | undefined {
	const label = serviceToolToStrix(String(event.tool ?? ""));
	if (!label || !SERVICE_NARRATED.has(label)) return undefined;
	const parts = [
		typeof event.exitCode === "number" ? `exit ${event.exitCode}` : "",
		typeof event.durationMs === "number" ? `${(event.durationMs / 1000).toFixed(1)}s` : "",
	]
		.filter(Boolean)
		.join(" · ");
	return {
		patch: {
			ok: event.ok !== false,
			...(parts ? { detail: parts } : {}),
			...(event.output ? { output: String(event.output) } : {}),
		},
	};
}

/**
 * A conversation message as a trace row.
 *
 * The panel draws the operator's own words and the host agent's answer; a compaction
 * marker is kept as a dim note, and an empty message is noise.
 */
export function hostRowFor(message: ConversationMessage): Omit<TraceEntry, "id" | "at"> | undefined {
	const text = message.text.trim();
	if (!text) return undefined;
	if (message.role === "assistant") return { kind: "host-say", label: text };
	if (message.role === "user") return { kind: "host", label: text };
	return { kind: "note", label: text };
}
