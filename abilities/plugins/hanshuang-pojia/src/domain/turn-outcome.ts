/**
 * 一轮对话**为什么结束**的判定。
 *
 * 此前只有一条路径：`refusal.ts` 判「这是不是拒绝」，是就续跑。它把两件性质完全不同的事
 * 混成了一个：模型明确说不答，和通道没能把回答送回来。两者对用户的含义相反：
 *
 *   - 内容拒答是**一个答案**。正文完整、HTTP 200、语义是「我不做」。重发同一件事不会改变
 *     它，能改变的是用户自己换一种说法，或者换一个目标。
 *   - 技术故障是**没有答案**。超时、429、401、5xx、连接中断。这些重试有意义，而且重试
 *     必须有可见次数，否则用户看到的是「卡住了」。
 *
 * 所以这里把结果分成三态：`clean` / `refusal` / `failure`。判定是纯函数，不读盘不看时钟。
 * 调用方（`runtime/contributions.ts` 的 Stop 钩子、`services/chat.ts` 的投递失败）各自
 * 决定怎么处置，本模块只负责「这是什么」，不负责「要不要再来一次」。
 */

import { detectRefusal, type RefusalSignal } from "./refusal";

/** 技术故障的分类。每一项对应一句用户能照做的提示，不写「请稍后重试」这种空话。 */
export type FailureKind = "timeout" | "rate-limit" | "auth" | "server" | "transport" | "unknown";

export interface TurnFailure {
	kind: FailureKind;
	/** 原始文案的一行，用于复核；超长截断。 */
	detail: string;
}

export type TurnOutcome =
	| { kind: "clean" }
	| { kind: "refusal"; signal: RefusalSignal }
	| { kind: "failure"; failure: TurnFailure };

/**
 * 按文案归类技术故障。
 *
 * 只看文案是因为宿主的错误对象跨 IPC 后只剩 message（cause 会丢），这与 `sample-error.ts`
 * 判路径越界是同一套妥协。顺序有讲究：先认出「配额/速度」再认「认证」——429 的文案里
 * 常同时出现 rate 与 key，先判认证会把限流误报成配置错误。
 */
const FAILURE_PATTERNS: ReadonlyArray<{ kind: FailureKind; re: RegExp }> = [
	{ kind: "rate-limit", re: /(rate[ _-]?limit|too many requests|\b429\b|quota|exceeded.*(?:token|request)|限流|请求过多|配额)/i },
	{ kind: "auth", re: /(\b401\b|\b403\b|unauthori[sz]ed|invalid[ _-]?api[ _-]?key|authentication|not authenticated|未授权|鉴权失败|密钥无效)/i },
	{ kind: "timeout", re: /(\b408\b|\b504\b|timed?[ _-]?out|timeout|deadline exceeded|超时)/i },
	{ kind: "server", re: /(\b5\d\d\b|internal server error|bad gateway|service unavailable|overloaded|服务不可用|服务器错误)/i },
	{ kind: "transport", re: /(ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|network error|fetch failed|连接中断|网络)/i },
];

/** 故障是否值得自动重试。认证失败重试只会再失败一次，并让用户以为「插件在忙」。 */
export function isRetryable(kind: FailureKind): boolean {
	return kind === "rate-limit" || kind === "timeout" || kind === "server" || kind === "transport";
}

/** 一句可照做的提示。i18n 由面板负责，这里只给键与参数。 */
export function failureHint(kind: FailureKind): string {
	return `chat.failure.${kind}`;
}

export function classifyFailure(error: unknown): TurnFailure {
	const detail = (error instanceof Error ? error.message : String(error ?? "")).trim();
	for (const { kind, re } of FAILURE_PATTERNS) {
		if (re.test(detail)) return { kind, detail: truncate(detail) };
	}
	return { kind: "unknown", detail: truncate(detail) };
}

function truncate(text: string): string {
	return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

/**
 * 一轮自然停止时的判定。
 *
 * 只做一件事：这条助手消息是「答案」还是「拒绝」。通道故障到不了这里——它在投递那一侧
 * 就被归成 `failure` 了。所以这里不需要再猜「是不是网络问题」。
 */
export function classifyStop(lastAssistantMessage: string | null | undefined): TurnOutcome {
	const signal = detectRefusal(lastAssistantMessage ?? "");
	return signal ? { kind: "refusal", signal } : { kind: "clean" };
}
