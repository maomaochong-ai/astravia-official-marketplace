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

/**
 * What this call acts on, per tool — the line a reader needs under the tool name.
 *
 * 这曾经是 strix-tools 里的 `describeToolCall`：一个没人调用的导出，还引用着已删除的
 * `strix_spawn_agent` / `strix_ask_user`。逐工具的“这一行代表什么”本身是对的，只是放错了
 * 地方——轨迹的唯一使用点在投影层，所以搬到这里，并按**每个工具的语义**取值，而不是
 * 猜一个通用的键名顺序（`targets` 在 sandbox_start 是目标，在 scope 是范围声明）。
 */
const DETAIL_KEYS: Record<string, readonly string[]> = {
	strix_exec: ["command"],
	strix_patch: ["patch"],
	strix_view_image: ["path"],
	strix_write_stdin: ["sessionId"],
	strix_kill_session: ["sessionId"],
	strix_shell_sessions: ["sessionId"],
	strix_think: ["thought"],
	strix_scope: ["targets"],
	strix_sandbox_start: ["targets"],
	strix_report: ["targets"],
	strix_load_skills: ["names", "skills"],
	strix_file_finding: ["title"],
	strix_update_finding: ["title"],
	strix_note_create: ["title"],
	strix_note_update: ["title"],
	strix_note_get: ["id"],
	strix_note_delete: ["id"],
	strix_todo_create: ["todos"],
	strix_todo_update: ["ids"],
	strix_todo_remove: ["ids"],
	strix_coverage_record: ["surface", "outcome"],
	strix_coverage_update: ["id", "outcome"],
	strix_browser: ["action", "target"],
	strix_proxy: ["action"],
};

function text(value: unknown): string | undefined {
	if (typeof value === "string") return value.trim() || undefined;
	if (Array.isArray(value)) {
		const parts = value.map((item) => (typeof item === "string" ? item : (item as { title?: string })?.title ?? ""));
		const joined = parts.filter(Boolean).join(" · ");
		return joined || undefined;
	}
	return undefined;
}

function detailOf(tool: string, args: Record<string, unknown> | undefined): string | undefined {
	const values = args ?? {};
	const keys = DETAIL_KEYS[tool] ?? ["command", "query", "title", "name", "targets", "names"];
	const parts: string[] = [];
	for (const key of keys) {
		const value = text(values[key]);
		if (value) parts.push(value);
	}
	const joined = parts.join(" → ");
	return joined || undefined;
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
	const detail = input.command ?? detailOf(label, input.args);
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
 * A turn boundary: the panel says *which* turn it is, and where the words are.
 *
 * 这里曾经是 `hostRowFor`：把 `message-added` 的正文（用户的句子与 agent 的回复）抄成
 * 轨迹行。那是本插件最明显的一处冗余——宿主聊天区已经把同样的话渲染完了，而且更好
 *（markdown、可复制、可回滚）；面板再画一遍只是把同一段字变成两个可滚区域。
 *
 * 现在这里只产出分隔行：编号 + 一句「说明在对话里」。它给现场一个时间锚点，
 * 不复制任何内容（ADR strix-0007）。
 */
export function turnDivider(turn: number, label: string): Omit<TraceEntry, "id" | "at"> {
	return { kind: "note", label: label.replace("{turn}", String(turn)) };
}
