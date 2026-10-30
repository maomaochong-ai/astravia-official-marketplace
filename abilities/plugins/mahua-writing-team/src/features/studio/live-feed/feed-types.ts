/**
 * 运行台活动流的事件形状（ADR 0027 §1 修订版）。
 *
 * 一条事件只允许写**宿主真的交过来的东西**：工具名、工具入参、工具返回、错误文本、
 * 会话 id。模型名与上下文占用依旧不在其中——那不是「暂时没做」，是插件层拿不到。
 */

/** 事件从哪一层来：宿主团队协作工具、本插件工具、子智能体生命周期。 */
export type FeedOrigin = "team" | "studio" | "agent";

/** 与宿主 hook 的三个工具阶段一一对应。 */
export type FeedStatus = "start" | "done" | "failed";

export interface FeedEvent {
	/** 进程内自增序号 + 时间戳，用于 React key 与去重。 */
	id: string;
	/** 事件发生在哪一刻（ISO，来自 hook 触发时读取的时钟）。 */
	at: string;
	origin: FeedOrigin;
	/** 事实文案的 catalog key；参数只放事件里真实出现的字段。 */
	textKey: string;
	textParams?: Record<string, string | number>;
	status: FeedStatus;
	/** 事件自身点名的主体：派活对象、收件人、子智能体类型。 */
	actor?: string;
	/** 能确定时给出章号；确定不了就留空，不猜。 */
	chapter?: number;
	/** 失败时的原始错误文本，原样显示，不翻译。 */
	detail?: string;
}

/** hook handler 交给描述器的原始事实。 */
export interface ToolEventFacts {
	eventName: "PreToolUse" | "PostToolUse" | "PostToolUseFailure";
	/** 宿主侧工具名，可能带命名空间前缀。 */
	toolName: string;
	input: unknown;
	response?: unknown;
	error?: string;
	/** 事件时刻，由调用方注入，描述器本身不读时钟。 */
	at: string;
}
