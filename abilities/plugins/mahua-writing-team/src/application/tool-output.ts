/**
 * 工具输出的两个公共出口：本地化路由理由、把 status 压成事实包。
 *
 * 纪律见 ADR 0007：写工具只回事实，下一步只从 `mahua_next_instruction` 取。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

import type { Instruction } from "../domain/novel-types.js";
import type { StudioService } from "./studio-service.js";

/**
 * 工具输出里的理由要给模型看得懂的自然语言，catalog key 留给自己。
 * 语言跟宿主的 `ctx.i18n` 走，因此同一份路由结果在中英文界面下都对。
 */
export function localize(ctx: PluginContext, instruction: Instruction | null): Record<string, unknown> | null {
	if (!instruction) return null;
	const { reasonKey, reasonParams, ...facts } = instruction;
	return { ...facts, reason: ctx.i18n.t(reasonKey, reasonParams) };
}

/**
 * 只返事实。下一步只能从 `mahua_next_instruction` 拿（ADR 0007）：
 * 两个出口都报路由结果，模型就会看到两份可能不一致的"下一步"。
 */
export function summaryOf(result: Awaited<ReturnType<StudioService["status"]>>): Record<string, unknown> {
	if (!result.ok) return { ok: false, error: result.error, detail: result.detail };
	const { book } = result.data;
	const chapter = book.chapters.find((item) => item.n === book.progress.currentChapter) ?? null;
	return {
		ok: true,
		bookId: book.id,
		title: book.title,
		phase: book.phase,
		currentChapter: book.progress.currentChapter,
		committedCount: book.progress.committedCount,
		targetChapters: book.targetChapters,
		currentChapterStatus: chapter?.status ?? null,
		currentChapterWords: chapter?.words ?? 0,
		pendingRewrite: book.progress.pendingRewrite,
	};
}
