import { useTranslation } from "@astravia-org/plugin-sdk";

import type { BookIndexEntry } from "../../../repository/manuscript-repository.js";
import { progressPercent } from "../bookshelf-model.js";
import { wordsOf } from "../library-model.js";
import { BookCover } from "./BookCover.js";

interface LibraryCardProps {
	book: BookIndexEntry;
	onOpen: (bookId: string) => void;
}

/**
 * 书库的一格（ADR 0020 §3）：左封面 72×94，右侧四行——书名 / 题材·阶段·章数 /
 * 简介 3 行 / 页脚更新日期 + 进度条。数字全部来自索引，打开列表不读正文。
 */
export function LibraryCard({ book, onOpen }: LibraryCardProps) {
	const { t } = useTranslation();
	const words = wordsOf(book);
	const premise = book.premise?.trim();
	return (
		<button
			type="button"
			onClick={() => onOpen(book.id)}
			className="flex w-full items-stretch gap-2.5 rounded-lg border border-border/60 p-2.5 text-left transition-colors hover:bg-muted/40"
		>
			{/* 题材、阶段、进度都写在右侧，封面不再重复一遍（ADR 0020 §3）。 */}
			<BookCover seed={book.id} title={book.title} variant="list" />
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<span className="truncate text-sm font-medium">{book.title}</span>
				<span className="truncate text-xs text-muted-foreground">
					{t("library.card.meta", {
						genre: book.genre?.trim() || t("library.card.noGenre"),
						phase: t(`phase.${book.phase}`),
						count: book.committedCount,
						words,
					})}
				</span>
				<span className="line-clamp-3 text-xs leading-5 text-muted-foreground">
					{premise || t("library.card.noPremise")}
				</span>
				<div className="mt-auto flex items-center gap-2">
					<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
						{t("library.card.updated", { date: book.updatedAt.slice(0, 10) })}
					</span>
					<span className="block h-0.5 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/15">
						<span
							className="block h-full rounded-full bg-foreground/40"
							style={{ width: `${progressPercent(book)}%` }}
						/>
					</span>
				</div>
			</div>
		</button>
	);
}
