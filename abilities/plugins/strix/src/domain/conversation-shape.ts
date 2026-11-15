import type { ConversationState } from "@astravia-org/plugin-sdk";

/**
 * 会话的形态，以及面板对它到底能动什么。
 *
 * 宿主把两种会话塞进同一个 `ConversationState`，可见的区别只剩 `sessionPath`：
 *
 * | | 单智能体会话 | 团队会话 |
 * |---|---|---|
 * | 来源 | `activeSessionAtom` | `pluginConversationOverrideAtom` |
 * | `id` | 会话 runtimeId | 团队会话 id |
 * | `cwd` | 会话目录 | 团队工作区 |
 * | `sessionPath` | 有（`ActiveSession.sessionPath`） | **恒 null**（`snapshot()` 里写死） |
 * | `turn-start` | `session.subscribe` 翻译而来 | 团队输入框发送时直报 |
 * | 输入框上的插件入口 | 胶囊 + 行内条目 | **没有**（团队用另一套 composer） |
 * | `sendPrompt` 落到哪 | 本会话 | 上一个单会话（`pluginSendMessageRef` 没跟着切） |
 * | `abort()` 打到谁 | 本会话（`activeSessionAtom.runtimeId`） | 上一个单会话（同上） |
 *
 * 最后两行是这一版要处理的缺陷来源：面板的三条写路径（发、停、abort）都不是
 * "发给你正在看的这个会话"，而是"发给宿主此刻的活跃单会话"。在团队会话里，
 * 那个"活跃单会话"是**另一个项目的普通对话**——在 A 项目跑评估、在 B 项目点停止，
 * B 的对话被终止，就是这个。所以规则不是"小心一点"，而是按形态分别授权：
 *
 *  - 单会话：面板可以写，但只能写自己发起的那一轮；
 *  - 团队会话：面板只读，写入与停止交给团队输入框自己；
 *  - 跟随与否：单会话看胶囊（用户把这一轮交给了插件），团队会话没有可看的开关
 *    （缺席不是拒绝），直接跟随。
 */
export type ConversationShape = "none" | "single" | "team";

/**
 * 判形态。
 *
 * `sessionPath` 为空串也算团队：宿主的 `ActiveSession.sessionPath` 是必填字符串，
 * 新会话在会话文件落地前可能是空串；把它当团队只会让面板"多跟随一轮"，
 * 当单会话则会让面板在团队会话里写进别的会话——两害相权取前者。
 */
export function conversationShape(
	conversation: Pick<ConversationState, "id" | "sessionPath"> | null | undefined,
): ConversationShape {
	if (!conversation?.id) return "none";
	return conversation.sessionPath ? "single" : "team";
}

/**
 * 这一轮开始时要不要把面板带到前面。
 *
 * `engaged` 是胶囊的开关状态。团队会话里没有这颗胶囊可开，所以它在那里恒为 false；
 * 拿它当唯一条件是"没有开关 = 用户拒绝"，而事实是"这个地方根本没有开关"。
 */
export function shouldFollowTurn(shape: ConversationShape, engaged: boolean): boolean {
	// 团队会话没有这颗胶囊可开，它在那里恒为 false；拿它当唯一条件就是“没有开关 = 用户拒绝”。
	if (shape === "team") return true;
	// 其余（单会话，以及“还没收到 conversation-changed”的未知态）一律看胶囊：
	// 未知不等于团队，不能因为一帧没拿到形态就把团队会话的跟随再搞丢。
	return engaged;
}

/** 面板能对宿主会话做的动作。 */
export type HostAction = "send" | "stop";

export type ActionRefusal = "team-surface" | "not-this-conversation" | "no-run";

export interface ActionDecision {
	ok: boolean;
	reason?: ActionRefusal;
}

/**
 * 授权一次写动作。
 *
 * `runOwner` 是"本面板在哪一个会话里发起过运行"，`boundTo` 是"本面板此刻绑在哪个会话"。
 * 两者相等才停——这是会话隔离的唯一判据：插件只能收拾自己摆出来的东西。
 */
export function permitHostAction(input: {
	shape: ConversationShape;
	action: HostAction;
	/** 本面板发起运行的那个会话；没发起过就是 null。 */
	runOwner: string | null;
	/** 本面板此刻绑定的会话。 */
	boundTo: string | null;
}): ActionDecision {
	const { shape, action, runOwner, boundTo } = input;
	if (shape === "team") return { ok: false, reason: "team-surface" };
	if (shape === "none") return { ok: false, reason: "not-this-conversation" };
	if (action === "send") return { ok: true };
	if (!runOwner) return { ok: false, reason: "no-run" };
	if (!boundTo || runOwner !== boundTo) return { ok: false, reason: "not-this-conversation" };
	return { ok: true };
}
