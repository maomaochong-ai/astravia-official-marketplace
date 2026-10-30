import type {
	Disposable,
	PluginCodingAgentHookHandler,
	PluginContext,
} from "@astravia-org/plugin-sdk";
import { describeSubagentEvent, describeToolEvent } from "./features/studio/live-feed/describe-tool-event.js";
import type { FeedDraft } from "./features/studio/live-feed/describe-tool-event.js";
import { feedStore } from "./features/studio/live-feed/feed-store.js";
import { SCENARIOS } from "./scenarios.js";

/**
 * 场景口径只有一处（`src/scenarios.ts`）：工具能干活的两个场景，hook 也只在这两个里跑。
 * 团队成员的会话在做完 `resolve-session-config` 之后落到 `"project"`，所以团队协作的
 * 派活与消息天然被这里接住。
 */

/**
 * 事件流只读：handler 一律返回 `undefined`（= 继续），绝不改工具入参、不拦调用。
 *
 * 关于 `toolNames`：本文件**故意不写**。插件工具的 hostName 会被宿主加命名空间
 * （`plugin:<id>:<tool>` 一类的形态），而 `team_*` 是宿主自己的工具；任何一个名字
 * 猜错，hook 就静默地永不触发——那是比多跑几次更坏的失败。这里让所有工具事件都进来，
 * 在 `describeToolEvent` 里按名字过滤：不在目录里的直接丢弃，成本是一次字符串比较。
 */
export function registerLiveFeedHooks(ctx: PluginContext): Disposable {
	const disposable: Disposable[] = [];

	const record = (draft: FeedDraft | null): void => {
		if (draft) feedStore.append(draft);
	};

	/** 一条事件渲染不出来（入参畸形、结构变了）不该让这一轮工具调用失败。 */
	const guard =
		<Context>(body: (context: Context) => void) =>
		(context: Context): void => {
			try {
				body(context);
			} catch {
				// 静默：活动流是观感层，失败不影响任务。
			}
		};

	const onPreToolUse: PluginCodingAgentHookHandler<"PreToolUse"> = guard((context) => {
		const { event } = context;
		record(
			describeToolEvent({
				eventName: "PreToolUse",
				toolName: event.tool.hostName,
				input: event.toolInput,
				at: new Date().toISOString(),
			}),
		);
	});

	const onPostToolUse: PluginCodingAgentHookHandler<"PostToolUse"> = guard((context) => {
		const { event } = context;
		record(
			describeToolEvent({
				eventName: "PostToolUse",
				toolName: event.tool.hostName,
				input: event.toolInput,
				response: event.toolResponse,
				at: new Date().toISOString(),
			}),
		);
	});

	const onPostToolUseFailure: PluginCodingAgentHookHandler<"PostToolUseFailure"> = guard((context) => {
		const { event } = context;
		record(
			describeToolEvent({
				eventName: "PostToolUseFailure",
				toolName: event.tool.hostName,
				input: event.toolInput,
				error: event.error,
				at: new Date().toISOString(),
			}),
		);
	});

	const onSubagentStart: PluginCodingAgentHookHandler<"SubagentStart"> = guard((context) => {
		const { event } = context;
		record(describeSubagentEvent("start", event.agentType, new Date().toISOString()));
	});

	const onSubagentStop: PluginCodingAgentHookHandler<"SubagentStop"> = guard((context) => {
		const { event } = context;
		record(
			describeSubagentEvent("stop", event.agentType, new Date().toISOString(), event.lastAssistantMessage),
		);
	});

	disposable.push(
		ctx.agent.registerHook({
			id: "mahua-feed-pre-tool-use",
			eventName: "PreToolUse",
			scope_use: [...SCENARIOS],
			handler: onPreToolUse,
		}),
		ctx.agent.registerHook({
			id: "mahua-feed-post-tool-use",
			eventName: "PostToolUse",
			scope_use: [...SCENARIOS],
			handler: onPostToolUse,
		}),
		ctx.agent.registerHook({
			id: "mahua-feed-post-tool-use-failure",
			eventName: "PostToolUseFailure",
			scope_use: [...SCENARIOS],
			handler: onPostToolUseFailure,
		}),
		ctx.agent.registerHook({
			id: "mahua-feed-subagent-start",
			eventName: "SubagentStart",
			scope_use: [...SCENARIOS],
			handler: onSubagentStart,
		}),
		ctx.agent.registerHook({
			id: "mahua-feed-subagent-stop",
			eventName: "SubagentStop",
			scope_use: [...SCENARIOS],
			handler: onSubagentStop,
		}),
	);

	return {
		dispose() {
			for (const item of disposable) item.dispose();
		},
	};
}
