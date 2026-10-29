/**
 * 相关章节推荐（ADR 0021 §3）。
 *
 * 三条判据都只依赖已存事实：角色交集、伏笔埋点、同弧相邻。
 * 刻意不做向量、不做 LLM——推荐错了要能一眼看出来。
 */

import type { Chapter, NovelBook, StoryThread } from "./novel-types.js";
import { arcForChapter } from "./novel-flow.js";

export type RelatedReason = "thread" | "character" | "arc";

export interface RelatedChapter {
	n: number;
	title: string;
	reason: RelatedReason;
}

/** 只看最近这么多章：再往前的可以靠弧摘要回忆，逐章回读没有收益。 */
export const RELATED_WINDOW = 40;
export const RELATED_LIMIT = 6;
const PER_REASON = 2;

const PRIORITY: Record<RelatedReason, number> = { thread: 0, character: 1, arc: 2 };

function committed(book: NovelBook): Chapter[] {
	return book.chapters.filter((chapter) => chapter.status === "committed").sort((a, b) => a.n - b.n);
}

/**
 * 当前章可能出场的人：上一章已出场的角色 + 当前章纲/计划里被点名的演员。
 * 写之前无法确知新出场是谁，因此用「上一章 + 章纲点名」当近似，并在文档里说清这一点。
 */
function currentCast(book: NovelBook, previous: Chapter | null): Set<string> {
	const names = new Set<string>(previous?.facts?.characters ?? []);
	const at = book.progress.currentChapter;
	const outline = book.chapters.find((chapter) => chapter.n === at);
	const plan = book.plans.find((item) => item.n === at);
	const haystack = [outline?.title ?? "", plan?.goal ?? "", plan?.conflict ?? "", plan?.hook ?? ""].join(" ");
	for (const name of book.cast) {
		if (name && haystack.includes(name)) names.add(name);
	}
	return names;
}

export function relatedChapters(
	book: NovelBook,
	threads: readonly StoryThread[],
	limit: number = RELATED_LIMIT,
): RelatedChapter[] {
	const at = book.progress.currentChapter;
	const done = committed(book);
	const previous = done[done.length - 1] ?? null;
	// 上一章已经以 `previous` 的身份进了上下文包，再当「相关章节」推一次只是噪音。
	const window = done.filter(
		(chapter) =>
			chapter.n !== at && chapter.n !== previous?.n && chapter.n >= at - RELATED_WINDOW && chapter.n < at,
	);
	if (window.length === 0) return [];

	const byN = new Map(window.map((chapter) => [chapter.n, chapter]));
	const picked = new Map<number, RelatedReason>();

	const take = (reason: RelatedReason, numbers: number[]) => {
		let taken = 0;
		const ordered = [...numbers].sort((a, b) => b - a);
		for (const n of ordered) {
			if (taken >= PER_REASON) return;
			if (!byN.has(n) || picked.has(n)) continue;
			picked.set(n, reason);
			taken += 1;
		}
	};

	// 1. 伏笔埋点：到期未收与未回收的都算，最该回读。
	const plantedIn = threads.filter((thread) => byN.has(thread.plantedIn)).map((thread) => thread.plantedIn);
	take("thread", plantedIn);

	// 2. 角色交集：同一批人出现过的章。
	const cast = currentCast(book, previous);
	take(
		"character",
		window
			.filter((chapter) => (chapter.facts?.characters ?? []).some((name) => cast.has(name)))
			.map((chapter) => chapter.n),
	);

	// 3. 同弧相邻：弧内最靠后的章。
	const arc = arcForChapter(book.volumes, at);
	if (arc) {
		take(
			"arc",
			window.filter((chapter) => chapter.arcId === arc.id).map((chapter) => chapter.n),
		);
	}

	return [...picked.entries()]
		.map(([n, reason]) => ({ n, title: byN.get(n)?.title ?? "", reason }))
		.sort((a, b) => PRIORITY[a.reason] - PRIORITY[b.reason] || b.n - a.n)
		.slice(0, limit);
}
