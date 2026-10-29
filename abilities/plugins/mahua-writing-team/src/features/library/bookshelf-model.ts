/**
 * 书架的纯计算部分（ADR 0013）：排序、封面首字、进度、段落切分、字号档。
 *
 * 这里不产生任何文案，也不读存储——界面与测试共用同一组函数，避免「显示的和算出来的不一致」。
 */

import type { BookIndexEntry } from "../../repository/manuscript-repository.js";

/**
 * 阅读页字号五档，取番茄阅读器那根滑杆的实测值 16 / 20 / 24 / 28 / 32。
 * 用真像素而不是 Tailwind 尺度：宿主尺度只有 14–24，最末两档根本到不了。
 */
export const READER_SCALES = ["text-[16px]", "text-[20px]", "text-[24px]", "text-[28px]", "text-[32px]"] as const;

export type ReaderScale = (typeof READER_SCALES)[number];

/** 默认第三档：桌面端长文本最舒适的一档。 */
export const DEFAULT_READER_SCALE = 2;

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

export function scaleClass(index: number): ReaderScale {
	const bounded = Math.min(READER_SCALES.length - 1, Math.max(0, index));
	return READER_SCALES[bounded] as ReaderScale;
}
