/**
 * 工作台的纯计算：把 `NovelBook` 折算成七帧要显示的那几个数。
 *
 * 只读、无副作用、不碰时钟（`now` 一律由调用方递进来），因此可以在任意帧里重复调用，
 * 也可以单独测。这里不产生任何"下一步""建议"，那是 `routeNovel` 的事——工作台不派活。
 */

import type { Arc, NovelBook, StoryThread, Volume } from "../../domain/novel-types.js";

/** 章节在界面上的五态，与设计稿的圆点一一对应。 */
export type ChapterState = "committed" | "reviewed" | "drafting" | "planned" | "blocked";

export interface CoverSeed {
	/** 封面上的那一个字：书名首字；书名空着就不印字，只留纸纹。 */
	mark: string;
	motif: number;
	layer: number;
	/** 纸纹底片的下标。与图案分开取，免得四张底片和三套图案同频对应。 */
	art: number;
}

/** 底片张数。改这个数要同时改 `cover-art.ts` 的清单，否则封面会挑到空位。 */
const COVER_ART_COUNT = 4;

/** 书名 → 封面。同一个书名永远得到同一个图案，换书才换样子。 */
export function coverSeed(title: string): CoverSeed {
	const mark = Array.from(title.trim())[0] ?? "";
	let hash = 0;
	for (const char of title) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 100_003;
	return { mark, motif: hash % 3, layer: Math.floor(hash / 3) % 3, art: Math.floor(hash / 7) % COVER_ART_COUNT };
}

export function chapterStateOf(status: string | undefined): ChapterState {
	switch (status) {
		case "committed":
		case "reviewed":
		case "drafting":
		case "blocked":
			return status;
		default:
			return "planned";
	}
}

export function arcOf(book: NovelBook, chapter: number): Arc | null {
	for (const volume of book.volumes) {
		const hit = volume.arcs.find((arc) => chapter >= arc.from && chapter <= arc.to);
		if (hit) return hit;
	}
	return null;
}

export function committedCount(book: NovelBook): number {
	return book.chapters.filter((chapter) => chapter.status === "committed").length;
}

/** 已提交章的字数合计——台账与书架说的「字数」只算落盘的。 */
export function committedWords(book: NovelBook): number {
	return book.chapters.reduce((sum, chapter) => (chapter.status === "committed" ? sum + chapter.words : sum), 0);
}

/**
 * 已提交的最高章号——「正文写到哪儿」的唯一口径。
 *
 * 弧带、伏笔审计与「距收弧还有几章」都从这一个数往回算，别再各写一遍 reduce。
 */
export function committedFrontier(book: NovelBook): number {
	return book.chapters.reduce((max, chapter) => (chapter.status === "committed" ? Math.max(max, chapter.n) : max), 0);
}

export function percent(part: number, whole: number): number {
	if (whole <= 0) return 0;
	return Math.min(100, Math.round((part / whole) * 100));
}

/** 一万一档：42.4 万字。界面上一律一位小数，不四舍五入成整数。 */
export function wanWords(words: number): string {
	if (words <= 0) return "0";
	const wan = words / 10_000;
	return wan >= 100 ? String(Math.round(wan)) : wan.toFixed(1);
}

export function formatCount(value: number): string {
	return value.toLocaleString("en-US");
}

export interface ElapsedLabel {
	key: "time.now" | "time.minutes" | "time.hours" | "time.days";
	count: number;
}

/** 相对时间。没有时间戳时给 null，让界面自己决定说什么。 */
export function elapsedSince(iso: string | undefined, nowMs: number): ElapsedLabel | null {
	if (!iso) return null;
	const then = Date.parse(iso);
	if (Number.isNaN(then)) return null;
	const minutes = Math.max(0, Math.round((nowMs - then) / 60_000));
	if (minutes < 1) return { key: "time.now", count: 0 };
	if (minutes < 60) return { key: "time.minutes", count: minutes };
	const hours = Math.round(minutes / 60);
	if (hours < 24) return { key: "time.hours", count: hours };
	return { key: "time.days", count: Math.round(hours / 24) };
}

export type ThreadState = "open" | "closed" | "overdue";

/** 伏笔的三态：还了、逾期、还在册。判定标准与 `auditThreads` 一致。 */
export function threadStateOf(thread: StoryThread, committedMax: number): ThreadState {
	if (thread.status === "closed") return "closed";
	return thread.dueIn < committedMax ? "overdue" : "open";
}

/** 台账里「最近一条到期」的那条，书页底部虚线只说这一条。 */
export function soonestOpenThread(threads: readonly StoryThread[], committedMax: number): StoryThread | null {
	const pending = threads.filter((thread) => threadStateOf(thread, committedMax) !== "closed");
	if (pending.length === 0) return null;
	return [...pending].sort((a, b) => a.dueIn - b.dueIn)[0] ?? null;
}

export function openThreadCount(threads: readonly StoryThread[]): number {
	return threads.filter((thread) => thread.status !== "closed").length;
}

/** 目录里的「分数」：评审过的章才有，没评审就是 null（不显示 0，那会被读成不及格）。 */
export function scoreOf(chapter: { reviewScore?: number | null } | undefined): number | null {
	const score = chapter?.reviewScore;
	return typeof score === "number" && score > 0 ? score : null;
}

/** 阅读页的字号档位：16 起、28 止，步长 2。行高跟着字号走 1.75 倍。 */
export const READER_SIZES: readonly number[] = [16, 18, 20, 22, 24, 28];

export function readerLineHeight(size: number): number {
	return Math.round(size * 1.75);
}

/** 正文按空行切段，供阅读页排版；不重排、不改字。 */
export function paragraphsOf(text: string): string[] {
	return text
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter((block) => block.length > 0);
}
