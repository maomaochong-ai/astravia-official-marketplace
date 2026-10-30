import { useTranslation } from "@astravia-org/plugin-sdk";
import type { NovelBook } from "../../../domain/novel-types.js";
import { dateOf } from "../../library/bookshelf-model.js";

/**
 * 顶部那一条同步带（设计稿 `SyncBar` 的诚实版，ADR 0026 §5）。
 *
 * 设计稿左侧写「团队正在写 · 2m 14s」——插件拿不到团队的真实计时，写上去就是假数。
 * 这里只放能对上账的四个事实：这一章是哪一章、哪些字已经落盘、文件在哪、最后一次
 * 落盘是哪天。团队在宿主的对话里跑，这条带子只负责说「这一页是上一次落盘的样子」。
 */
export function StudioStrip({ book }: { book: NovelBook }) {
	const { t } = useTranslation();
	const n = book.progress.currentChapter;
	const chapter = book.chapters.find((item) => item.n === n) ?? null;
	const file = `books/${book.id}/chapters/${n}.md`;
	const drafting = chapter?.status === "drafting";

	return (
		<div className="flex h-8 shrink-0 items-center gap-2 border-b border-border/50 px-4 text-[10.5px] text-muted-foreground">
			<span
				aria-hidden="true"
				className={`size-1.5 shrink-0 rounded-full ${drafting ? "bg-primary" : "bg-muted-foreground/40"}`}
			/>
			<span className="min-w-0 truncate">
				{t("strip.now", { chapter: n, title: chapter?.title || t("board.untitled") })}
			</span>
			<span className="ml-auto hidden min-w-0 items-center gap-2 sm:flex">
				<span className="max-w-[12rem] truncate font-mono text-[11px] text-muted-foreground/80" title={file}>
					{file}
				</span>
				{chapter && chapter.words > 0 ? (
					<span className="shrink-0 tabular-nums">{t("board.words", { count: chapter.words })}</span>
				) : null}
				<span className="shrink-0 font-mono text-[10px] tabular-nums">
					{t("reader.updatedAt", { date: dateOf(book.updatedAt) })}
				</span>
			</span>
		</div>
	);
}
