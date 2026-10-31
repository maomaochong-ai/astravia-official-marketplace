/**
 * 运行台活动流的事件形状（ADR 0027 §1 修订版）。
 *
 * 一条事件只允许写**宿主真的交过来的东西**：工具名、工具入参、工具返回、错误文本、
 * 会话 id。上下文占用不在其中——那不是「暂时没做」，是插件层拿不到。
 */

/** 事件从哪一层来：宿主团队协作工具、本插件工具、子智能体生命周期。 */
export type ConsoleLogOrigin = "team" | "studio" | "agent";

/** 与宿主 hook 的三个工具阶段一一对应。 */
export type ConsoleLogStatus = "start" | "done" | "failed";

export interface ConsoleLogEvent {
	/** 进程内自增序号 + 时间戳，用于 React key 与去重。 */
	id: string;
	/** 事件发生在哪一刻（ISO，来自 hook 触发时读取的时钟）。 */
	at: string;
	origin: ConsoleLogOrigin;
	/** 宿主交过来的工具名（已去掉命名空间前缀），运行台照原样用等宽字显示。 */
	tool?: string;
	/** 事实文案的 catalog key；参数只放事件里真实出现的字段。 */
	textKey: string;
	textParams?: Record<string, string | number>;
	status: ConsoleLogStatus;
	/** 事件自身点名的主体：派活对象、收件人、子智能体类型。 */
	actor?: string;
	/** 能确定时给出章号；确定不了就留空，不猜。 */
	chapter?: number;
	/** 宿主交过来的模型名（同一个团队可能不止一个）。 */
	model?: string;
	/** 同一次工具调用从 PreToolUse 到结束的毫秒数；只有成对齐全才有值。 */
	ms?: number;
	/** 失败时的原始错误文本，原样显示，不翻译。 */
	detail?: string;
}

/** 描述器产出的草稿：`id` 由 store 分配。 */
export type ConsoleLogDraft = Omit<ConsoleLogEvent, "id">;

/** hook handler 交给描述器的原始事实。 */
export interface ToolEventFacts {
	eventName: "PreToolUse" | "PostToolUse" | "PostToolUseFailure";
	/** 宿主侧工具名，可能带命名空间前缀。 */
	toolName: string;
	input: unknown;
	response?: unknown;
	error?: string;
	/** 宿主交过来的模型名。 */
	model?: string;
	/** 调用耗时；由 handler 按 toolUseId 配对算，描述器不读时钟。 */
	ms?: number;
	/** 事件时刻，由调用方注入，描述器本身不读时钟。 */
	at: string;
}
