/**
 * 上下文包：一次交给 Writer 的事实集合。
 *
 * 上游 `novel_context` 是工具，这里同样是工具，但组装逻辑是纯函数，方便单测，
 * 也保证"给模型看什么"只有一处定义——工具与工作台视图读的是同一份结构。
 *
 * ADR 0021 之后这里是「分层摘要 + 伏笔 + 相关章节」的唯一出口：字段顺序就是建议阅读顺序。
 */

import type { Chapter, NovelBook, OutlineFeedback, StoryThread } from "./novel-types.js";
import { arcForChapter } from "./novel-flow.js";
import { openThreads } from "./thread-ledger.js";
import { relatedChapters, type RelatedChapter } from "./related-chapters.js";

export interface ContextPack {
	bookId: string;
	title: string;
	genre: string;
	phase: NovelBook["phase"];
	foundation: NovelBook["foundation"];
	cast: string[];
	currentChapter: number;
	arc: { id: string; title: string; goal: string; from: number; to: number } | null;
	/** 到期未收的伏笔，按 `dueIn` 升序；空数组表示台账干净。 */
	openThreads: StoryThread[];
	previous: { n: number; title: string; closing: string } | null;
	/** 最多 6 条，带理由；回读走 `mahua_read_chapter`，不要当摘要用。 */
	relatedChapters: RelatedChapter[];
	/** 弧/卷摘要：跨弧、跨卷时才需要读。 */
	summaries: NovelBook["summaries"];
	openFeedback: OutlineFeedback[];
	styleSample: string;
}

function previousCommitted(book: NovelBook): Chapter | null {
	const done = book.chapters
		.filter((chapter) => chapter.status === "committed")
		.sort((a, b) => a.n - b.n);
	return done[done.length - 1] ?? null;
}

export function buildContext(book: NovelBook, threads: readonly StoryThread[] = []): ContextPack {
	const arc = arcForChapter(book.volumes, book.progress.currentChapter);
	const previous = previousCommitted(book);
	return {
		bookId: book.id,
		title: book.title,
		genre: book.genre,
		phase: book.phase,
		foundation: book.foundation,
		cast: book.cast,
		currentChapter: book.progress.currentChapter,
		arc: arc ? { id: arc.id, title: arc.title, goal: arc.goal, from: arc.from, to: arc.to } : null,
		openThreads: openThreads(threads),
		previous: previous
			? { n: previous.n, title: previous.title, closing: previous.facts?.closing ?? "" }
			: null,
		relatedChapters: relatedChapters(book, threads),
		summaries: book.summaries,
		openFeedback: book.feedback.filter((item) => item.status === "open"),
		styleSample: book.styleSample,
	};
}
