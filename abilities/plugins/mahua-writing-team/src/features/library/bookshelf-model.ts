/**
 * 书架的纯计算部分（ADR 0013）：排序、封面首字、进度、段落切分、字号档。
 *
 * 这里不产生任何文案，也不读存储——界面与测试共用同一组函数，避免「显示的和算出来的不一致」。
 */

import type { BookIndexEntry } from "../../repository/manuscript-repository.js";

/**
 * 阅读页字号五档，取番茄阅读器的实测档位 16 / 20 / 24 / 28 / 32。
 * 存像素值而不是 Tailwind 尺度：宿主尺度只有 14–24，最末两档根本到不了。
 * 每档的行高、缩进、段间不对应 Tailwind 类，整张表在 `READER_TYPE` 里。
 */
export const READER_SCALES = [16, 20, 24, 28, 32] as const;

export type ReaderScale = (typeof READER_SCALES)[number];

/** 默认第一档（16px）：番茄自己的默认档，窄面板里 24px 一行放不下几个字。 */
export const DEFAULT_READER_SCALE = 0;

const RECENT_LIMIT = 5;

export function sortedByRecent(books: readonly BookIndexEntry[]): BookIndexEntry[] {
	return [...books].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function recentBooks(books: readonly BookIndexEntry[], limit = RECENT_LIMIT): BookIndexEntry[] {
	return sortedByRecent(books).slice(0, limit);
}

/** 封面首字：中文取第一个字，拉丁取首字母大写。空书名给问号而不是空白。 */
export function coverMark(title: string): string {
	const trimmed = title.trim();
	const first = [...trimmed][0];
	return first === undefined ? "?" : first.toUpperCase();
}

/** 目标章数为 0 时不除零；超额完成也封顶 100。 */
export function progressPercent(entry: Pick<BookIndexEntry, "committedCount" | "targetChapters">): number {
	if (entry.targetChapters <= 0) return 0;
	const percent = Math.round((entry.committedCount / entry.targetChapters) * 100);
	return Math.min(100, Math.max(0, percent));
}

/** 中文小说一段一行，按行切；空行与行尾空白丢掉。 */
export function paragraphsOf(text: string): string[] {
	return text
		.split(/\r?\n+/)
		.map((paragraph) => paragraph.trim())
		.filter((paragraph) => paragraph.length > 0);
}

/** 只取日期部分：阅读页的「更新于」不显示秒，也不做时区换算。 */
export function dateOf(iso: string): string {
	return iso.slice(0, 10);
}

export interface ReaderType {
	body: number;
	bodyLine: number;
	bodyIndent: number;
	bodyGap: number;
	title: number;
	titleLine: number;
	titleGap: number;
	meta: number;
	metaLine: number;
	metaGap: number;
}

/**
 * 番茄 `Reader-*.css` 里 `.muye-reader-content-16/20/24/28/32` 的逐档数值（rem × 10 = px）。
 * 正文行高恒等于「字号 × 2」，首行缩进也恒等于「字号 × 2」，段间从 1× 缓落到 0.75×——
 * 「读起来像书」靠的就是这三条比例，绝对值只是跟着字号放大。
 */
const READER_TYPE: Record<ReaderScale, ReaderType> = {
	16: {
		body: 16,
		bodyLine: 32,
		bodyIndent: 32,
		bodyGap: 16,
		title: 18,
		titleLine: 27,
		titleGap: 8,
		meta: 12,
		metaLine: 18,
		metaGap: 36,
	},
	20: {
		body: 20,
		bodyLine: 39,
		bodyIndent: 40,
		bodyGap: 18,
		title: 22,
		titleLine: 33,
		titleGap: 10,
		meta: 14,
		metaLine: 21,
		metaGap: 44,
	},
	24: {
		body: 24,
		bodyLine: 45.6,
		bodyIndent: 48,
		bodyGap: 20,
		title: 26,
		titleLine: 39,
		titleGap: 12,
		meta: 16,
		metaLine: 24,
		metaGap: 56,
	},
	28: {
		body: 28,
		bodyLine: 51.8,
		bodyIndent: 56,
		bodyGap: 22,
		title: 30,
		titleLine: 45,
		titleGap: 14,
		meta: 18,
		metaLine: 27,
		metaGap: 60,
	},
	32: {
		body: 32,
		bodyLine: 57.6,
		bodyIndent: 64,
		bodyGap: 24,
		title: 34,
		titleLine: 51,
		titleGap: 16,
		meta: 20,
		metaLine: 30,
		metaGap: 72,
	},
};

/** 档位越界一律夹紧，界面拿不到不存在的字。 */
export function readerType(index: number): ReaderType {
	const bounded = Math.min(READER_SCALES.length - 1, Math.max(0, index));
	return READER_TYPE[READER_SCALES[bounded] as ReaderScale];
}
