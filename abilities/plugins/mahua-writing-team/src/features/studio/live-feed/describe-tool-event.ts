import type { FeedDraft, FeedStatus, ToolEventFacts } from "../../../application/live-feed/feed-types.js";
import { FEED_FIXED_KEYS, STUDIO_TOOL_FEED_LABELS, TEAM_TOOL_FEED_LABELS } from "./tool-catalog.js";

const PREVIEW_LIMIT = 80;

function recordOf(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function stringOf(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberOf(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function preview(value: string): string {
	const flat = value.replace(/\s+/g, " ").trim();
	return flat.length > PREVIEW_LIMIT ? `${flat.slice(0, PREVIEW_LIMIT)}…` : flat;
}

/**
 * 宿主给插件工具的 hostName 可能带命名空间（`plugin:…:mahua_save_chapter`）；
 * 目录里登记的是最后一段。工具名本身不含 `:` 与 `/`，所以从右切是安全的。
 */
export function normalizeToolName(hostName: string): string {
	const segments = hostName.split(/[:/]/);
	const last = segments[segments.length - 1];
	return last && last.length > 0 ? last : hostName;
}

function statusOf(eventName: ToolEventFacts["eventName"]): FeedStatus {
	if (eventName === "PreToolUse") return "start";
	if (eventName === "PostToolUseFailure") return "failed";
	return "done";
}

/** 章号：入参优先，其次工具返回。两处都没有就是确定不了，留空。 */
function chapterOf(input: Record<string, unknown> | null, response: Record<string, unknown> | null): number | undefined {
	return numberOf(input?.chapter) ?? numberOf(response?.chapter);
}

function describeTeamTool(
	name: string,
	facts: ToolEventFacts,
	input: Record<string, unknown> | null,
): FeedDraft | null {
	const textKey = TEAM_TOOL_FEED_LABELS[name];
	if (!textKey) return null;

	const status = statusOf(facts.eventName);
	const base: Omit<FeedDraft, "textKey" | "textParams" | "actor"> = {
		at: facts.at,
		origin: "team",
		status,
		tool: name,
		model: facts.model,
		ms: facts.ms,
		detail: facts.error,
	};

	switch (name) {
		case "team_delegate_task": {
			const target = stringOf(input?.target);
			if (!target) return null;
			return { ...base, textKey, textParams: { target }, actor: target };
		}
		case "team_send_message": {
			const recipients = Array.isArray(input?.recipients)
				? input.recipients.filter((item): item is string => typeof item === "string")
				: [];
			if (recipients.length === 0) return null;
			const joined = recipients.join(", ");
			return {
				...base,
				textKey,
				textParams: { recipients: joined, text: preview(stringOf(input?.text) ?? "") },
				actor: joined,
			};
		}
		case "team_wait_tasks": {
			const count = Array.isArray(input?.teamTaskIds) ? input.teamTaskIds.length : 0;
			return { ...base, textKey, textParams: { count } };
		}
		default: {
			const taskId = stringOf(input?.teamTaskId) ?? stringOf(input?.taskId);
			if (!taskId) return null;
			return { ...base, textKey, textParams: { taskId } };
		}
	}
}

function describeStudioTool(
	name: string,
	facts: ToolEventFacts,
	input: Record<string, unknown> | null,
	response: Record<string, unknown> | null,
): FeedDraft | null {
	const labelKey = STUDIO_TOOL_FEED_LABELS[name];
	if (!labelKey) return null;
	const chapter = chapterOf(input, response);
	return {
		at: facts.at,
		origin: "studio",
		status: statusOf(facts.eventName),
		tool: name,
		textKey: labelKey,
		textParams: chapter === undefined ? undefined : { chapter },
		chapter,
		model: facts.model,
		ms: facts.ms,
		detail: facts.error,
	};
}

/**
 * 一条工具事件该不该进流、以什么口径进流。
 *
 * 返回 `null` 表示这类工具不进流（读类工具、团队纯查询），调用方直接跳过。
 * 描述器不读时钟、不读存储、不发网络请求，所以可以在测试里逐条断言。
 */
export function describeToolEvent(facts: ToolEventFacts): FeedDraft | null {
	const name = normalizeToolName(facts.toolName);
	const input = recordOf(facts.input);
	const response = recordOf(facts.response);

	if (name in TEAM_TOOL_FEED_LABELS) return describeTeamTool(name, facts, input);
	if (name in STUDIO_TOOL_FEED_LABELS) return describeStudioTool(name, facts, input, response);
	return null;
}

/** 子智能体生命周期：团队会话里不触发，但普通会话里用子智能体也是真实发生的协作。 */
export function describeSubagentEvent(
	kind: "start" | "stop",
	agentType: string,
	at: string,
	lastMessage?: string | null,
): FeedDraft {
	return {
		at,
		origin: "agent",
		status: kind === "start" ? "start" : "done",
		textKey: kind === "start" ? FEED_FIXED_KEYS.subagentStart : FEED_FIXED_KEYS.subagentStop,
		textParams: { agentType },
		actor: agentType,
		detail: kind === "stop" && lastMessage ? preview(lastMessage) : undefined,
	};
}
