/**
 * 长文档的分片与续读。
 *
 * 为什么要切：340 篇里有 124 篇超过 12 000 字符、5 篇超过 60 000（最大 106 802）。
 * 早先的实现是 `text.slice(0, budget)` + 一行「已截断」，于是三种失败同时存在：
 * 读到半截的人不知道自己少了什么、想要后半段没有任何入口、`slice` 还会切在
 * 围栏代码块或表格中间，让片段渲染断裂。
 *
 * 这里只做三件事，都是纯函数：
 *   1. 在 Markdown 边界上切（标题优先，其次空行；不切断围栏代码块）；
 *   2. 告诉调用方剩下多少、从哪个偏移续读；
 *   3. 列出剩余部分的小节标题与偏移，让人知道「后面有什么」而不只是「还有多少」。
 *
 * 续读的正确性由一条性质保证：多次切片的拼接必须逐字等于原文
 * （见 src/test/knowledge/doc-slice.test.ts）。
 */

/** 剩余部分的一个小节。`offset` 是全文内的字符偏移，可直接回传给 `offset` 参数。 */
export interface DocOutlineEntry {
	readonly title: string;
	readonly offset: number;
}

export interface DocSlice {
	/** 本次返回的正文片段。 */
	readonly text: string;
	/** 片段起点（全文偏移）。 */
	readonly start: number;
	/** 片段终点（全文偏移，不含）。 */
	readonly end: number;
	/** 全文长度。 */
	readonly total: number;
	/** 下一次续读的偏移；null 表示已经读到末尾。 */
	readonly nextOffset: number | null;
	/** 剩余部分的小节标题，最多 8 条。 */
	readonly outline: readonly DocOutlineEntry[];
}

/** 默认预算：p90 = 26 447，取 24 000 能让九成文档一次读完，且单次约 7k tokens。 */
export const DEFAULT_DOC_BUDGET = 24_000;

/** 单次上限：60 000 字符约 18k tokens，再大就该分片而不是硬塞。 */
export const MAX_DOC_BUDGET = 60_000;

/** 切点下限：不允许为了找边界把片段缩到预算的六成以下。 */
const MIN_FILL_RATIO = 0.6;

const HEADING = /^#{1,3} .+$/gm;
const FENCE_LINE = /^```/gm;

/**
 * 找切点。
 *
 * 优先落在下一个标题之前，其次落在空行之前，最后才硬切。围栏代码块没闭合时
 * 回退到上一个围栏行，避免把一段代码劈成两半——那种片段读起来是坏的，
 * 而且会让 Markdown 渲染把后半篇当成代码。
 */
function cutAt(text: string, start: number, budget: number): number {
	const hard = Math.min(text.length, start + budget);
	if (hard >= text.length) return text.length;

	const window = text.slice(start, hard);
	const floor = Math.floor(window.length * MIN_FILL_RATIO);

	let limit = window.length;
	const fences = window.match(FENCE_LINE)?.length ?? 0;
	if (fences % 2 === 1) {
		const at = window.lastIndexOf("\n```");
		// 围栏回退不能把片段压到下限以下：那样宁可让它断一次，也不要退成一小撮。
		if (at >= floor) limit = at + 1;
	}

	for (const separator of ["\n## ", "\n# ", "\n### ", "\n\n"] as const) {
		const at = window.lastIndexOf(separator, limit - 1);
		if (at >= floor) return start + at + 1;
	}
	return start + limit;
}

/** 从 `from` 开始往下数若干个小节标题。偏移是全文偏移。 */
export function outlineAfter(text: string, from: number, limit = 8): DocOutlineEntry[] {
	const entries: DocOutlineEntry[] = [];
	HEADING.lastIndex = from;
	let match = HEADING.exec(text);
	while (match !== null && entries.length < limit) {
		entries.push({ title: match[0].trim(), offset: match.index });
		match = HEADING.exec(text);
	}
	return entries;
}

export function sliceDocument(text: string, offset = 0, budget = DEFAULT_DOC_BUDGET): DocSlice {
	const total = text.length;
	const start = Math.max(0, Math.min(Math.trunc(offset), total));
	const size = Math.max(500, Math.min(MAX_DOC_BUDGET, Math.trunc(budget)));
	const end = cutAt(text, start, size);
	const nextOffset = end >= total ? null : end;
	return {
		text: text.slice(start, end),
		start,
		end,
		total,
		nextOffset,
		outline: nextOffset === null ? [] : outlineAfter(text, nextOffset),
	};
}

export interface NoticeOptions {
	/** 文档 id：给了就能写出可以直接复制的续读调用。 */
	readonly id?: string;
	/** 调用方另有参数（如 `maxChars`）时，原样带上以免续读时预算被重置。 */
	readonly extraArgs?: Readonly<Record<string, string | number>>;
}

/**
 * 未读完时的说明。
 *
 * 不写成「已截断」——那句话只说了发生过什么，没说接下来怎么办。这里给三样东西：
 * 剩下的字符数、一条可复制的续读调用、剩余小节清单。
 */
export function partialNotice(slice: DocSlice, options: NoticeOptions = {}): string {
	if (slice.nextOffset === null) return "";
	const remaining = slice.total - slice.end;
	const call = options.id
		? `read_doc ${JSON.stringify({ id: options.id, offset: slice.nextOffset, ...options.extraArgs })}`
		: `read_doc with offset ${slice.nextOffset}`;
	const lines = [
		`... [PARTIAL: chars ${slice.start}–${slice.end} of ${slice.total} — ${remaining} left]`,
		`Continue with: ${call}`,
	];
	if (slice.outline.length > 0) {
		lines.push(`Next sections: ${slice.outline.map(entry => `"${entry.title}" @${entry.offset}`).join(" · ")}`);
	}
	return lines.join("\n");
}
