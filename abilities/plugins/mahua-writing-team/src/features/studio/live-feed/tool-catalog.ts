/**
 * 活动流用到的全部 catalog key 都在这里登记一次。
 *
 * 放在一个文件里是为了让守卫测试能一次扫全：宿主只渲染源码里写死的双语 key，
 * 而活动流的 key 是按工具名拼出来的，静态扫描看不见，只能靠这份表对账。
 */

/** 本插件工具 → 事实文案 key。只收**有写入或决策后果**的工具，读类工具不进流。 */
export const STUDIO_TOOL_FEED_LABELS: Readonly<Record<string, string>> = {
	// 立项与基础设定
	mahua_create_book: "feed.tool.createBook",
	mahua_accept_brief: "feed.tool.acceptBrief",
	mahua_save_foundation: "feed.tool.saveFoundation",
	mahua_set_user_rules: "feed.tool.setRules",
	// 规划
	mahua_save_plan: "feed.tool.savePlan",
	mahua_save_outline: "feed.tool.saveOutline",
	mahua_save_volume_summary: "feed.tool.saveVolumeSummary",
	mahua_revise_outline: "feed.tool.reviseOutline",
	mahua_flag_outline_feedback: "feed.tool.flagOutline",
	mahua_resolve_outline_feedback: "feed.tool.resolveOutline",
	// 正文
	mahua_start_drafting: "feed.tool.startDrafting",
	mahua_plan_chapter: "feed.tool.planChapter",
	mahua_save_chapter: "feed.tool.saveChapter",
	mahua_edit_chapter: "feed.tool.editChapter",
	mahua_expand_next_arc: "feed.tool.expandArc",
	mahua_save_arc_summary: "feed.tool.saveArcSummary",
	// 评审与提交
	mahua_save_review: "feed.tool.saveReview",
	mahua_commit_chapter: "feed.tool.commitChapter",
	mahua_close_arc: "feed.tool.closeArc",
	mahua_finalize: "feed.tool.finalize",
	mahua_arbitrate: "feed.tool.arbitrate",
	mahua_reopen_book: "feed.tool.reopenBook",
	// 伏笔
	mahua_flag_thread: "feed.tool.flagThread",
	mahua_close_thread: "feed.tool.closeThread",
};

/** 宿主团队协作工具 → 事实文案 key。`team_get_task` / `team_list_members` /
 * `team_read_shared_history` 是纯查询，进流只会淹没真事件，故不收。 */
export const TEAM_TOOL_FEED_LABELS: Readonly<Record<string, string>> = {
	team_delegate_task: "feed.team.delegate",
	team_send_message: "feed.team.message",
	team_wait_tasks: "feed.team.wait",
	team_continue_task: "feed.team.continue",
	team_retry_task: "feed.team.retry",
	team_cancel_task: "feed.team.cancel",
};

/** 固定文案：状态词、子智能体、空态与说明。 */
export const FEED_FIXED_KEYS = {
	statusStart: "feed.status.start",
	statusDone: "feed.status.done",
	statusFailed: "feed.status.failed",
	subagentStart: "feed.agent.start",
	subagentStop: "feed.agent.stop",
} as const;

/** 守卫测试用：所有可能被渲染的 key。 */
export function feedCatalogKeys(): string[] {
	return [
		...Object.values(STUDIO_TOOL_FEED_LABELS),
		...Object.values(TEAM_TOOL_FEED_LABELS),
		...Object.values(FEED_FIXED_KEYS),
	];
}
