/**
 * 面板能对宿主会话做什么（纯函数）。
 *
 * 1.0.16 起面板不再发消息：`send` 这条路整个删掉，`insertText` 也不再需要。
 * 剩下的唯一写动作是「停止」，而它的判据变了——
 *
 *   **停止的对象永远等于面板正在显示的那个会话。**
 *
 * 为什么这就够了：面板拿到的是宿主的活动会话快照（`useActiveConversation()`），
 * 而 `abort()` 打的是同一个活动会话（`activeSessionAtom`）。两者同源，所以"我看到的"
 * 与"我停掉的"是同一个会话，跨会话误伤在结构上不成立。
 *
 * 早期版本靠 `runOwner`（本面板发起过运行）来判，是因为面板当时能发消息；现在没有
 * 发起方，那个判据只会让停止键一直灰着。真机验证过：能看到这一轮、却停不了它，
 * 比"按了才发现停错"更让人困惑。
 *
 * 团队会话仍然只读：`abort()` 在那边指向的是上一个单会话，不是团队这一轮。
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
	conversation: { id: string | null; sessionPath: string | null } | null | undefined,
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
	// 团队会话没有这颗胶囊可开，它在那里恒为 false。
	if (shape === "team") return true;
	// 其余（单会话，以及"还没收到 conversation-changed"的未知态）一律看胶囊。
	return engaged;
}

export interface StopDecision {
	ok: boolean;
	/** 拒绝的原因，给界面出一句话。 */
	reason?: "team-surface" | "no-run" | "not-this-conversation";
}

/**
 * 停止按钮能不能用。
 *
 * - 团队会话：不能（`abort()` 不指向团队这一轮）；
 * - 这一轮没在跑：不能（没有可停的东西）；
 * - 其余：能——面板显示的会话就是宿主的活动会话。
 */
export function permitStop(input: {
	shape: ConversationShape;
	/** 这个会话此刻是否正在生成（宿主给的会话级信号）。 */
	streaming: boolean;
}): StopDecision {
	if (input.shape === "team") return { ok: false, reason: "team-surface" };
	if (input.shape === "none") return { ok: false, reason: "not-this-conversation" };
	if (!input.streaming) return { ok: false, reason: "no-run" };
	return { ok: true };
}
