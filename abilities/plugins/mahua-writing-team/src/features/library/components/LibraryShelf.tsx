import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { BookIndexEntry } from "../../../repository/manuscript-repository.js";
import { recentBooks, progressPercent, dateOf } from "../bookshelf-model.js";
import { BookCover } from "./BookCover.js";
import { NewBookForm } from "../../studio/components/NewBookForm.js";

interface LibraryShelfProps {
	books: BookIndexEntry[];
	creating: boolean;
	onOpen: (bookId: string) => void;
	/** 切到书库页：按状态、篇幅、题材过一遍作品（ADR 0020 §1）。 */
	onOpenCatalog: () => void;
	onContinue: (bookId: string, chapter: number) => void;
	onCreate: (input: {
		title: string;
		genre: string;
		premise: string;
		targetChapters: number;
	}) => Promise<boolean>;
}

/**
 * 书架（ADR 0013 §2.2，空态见 ADR 0016）：封面网格 + 最近更新行表，对应番茄首页的两块结构。
 * 空架只放三行：一句说明这是什么、一句说接下来做什么、一个主按钮。
 * 表单放在按钮后面展开，不在进页时就把十四个字段摆到人脸上。
 */
export function LibraryShelf({ books, creating, onOpen, onOpenCatalog, onContinue, onCreate }: LibraryShelfProps) {
	const { t } = useTranslation();
	const [composing, setComposing] = useState(false);
	const recent = recentBooks(books);

	if (books.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6">
				{composing ? (
					<div className="w-full max-w-md">
						<NewBookForm busy={creating} onCreate={onCreate} />
					</div>
				) : (
					<div className="flex max-w-xs flex-col items-center gap-1.5 text-center">
						<h1 className="text-sm font-medium">{t("shelf.emptyTitle")}</h1>
						<p className="text-sm text-muted-foreground">{t("shelf.emptyBody")}</p>
						<button
							type="button"
							onClick={() => setComposing(true)}
							className="mt-5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
						>
							{t("shelf.newBook")}
						</button>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
			<section className="flex flex-col gap-3">
				<div className="flex items-baseline justify-between gap-2">
					<h1 className="text-sm font-medium">{t("shelf.title")}</h1>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onOpenCatalog}
							className="rounded-md border border-border/60 px-2 py-0.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{t("shelf.openCatalog")}
						</button>
						<span className="text-xs tabular-nums text-muted-foreground">
							{t("shelf.count", { count: books.length })}
						</span>
						<button
							type="button"
							onClick={() => setComposing((open) => !open)}
							className="rounded-md border border-border/60 px-2 py-0.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
						>
							{composing ? t("shelf.cancelNew") : t("shelf.newBook")}
						</button>
					</div>
				</div>

				{composing ? <NewBookForm busy={creating} onCreate={onCreate} /> : null}

				<ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
					{books.map((entry) => (
						<li key={entry.id}>
							<button
								type="button"
								onClick={() => onOpen(entry.id)}
								className="group flex w-full flex-col gap-2 rounded-lg p-1 text-left transition-colors hover:bg-muted/40"
							>
								<BookCover
									title={entry.title}
									caption={t(`phase.${entry.phase}`)}
									progress={progressPercent(entry)}
								/>
								<div className="flex min-w-0 flex-col gap-0.5 px-0.5">
									<span className="truncate text-sm font-medium">{entry.title}</span>
									<span className="text-xs tabular-nums text-muted-foreground">
										{t("shelf.progress", {
											done: entry.committedCount,
											total: entry.targetChapters,
										})}
									</span>
								</div>
							</button>
						</li>
					))}
				</ul>
			</section>

			<section className="flex flex-col gap-2">
				<h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{t("shelf.recent")}
				</h2>
				<ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border/60">
					{recent.map((entry) => (
						<li key={entry.id}>
							<button
								type="button"
								onClick={() => onContinue(entry.id, entry.currentChapter)}
								className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40"
							>
								<span className="min-w-0 flex-1 truncate text-sm">{entry.title}</span>
								<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
									{t("shelf.continueAt", { chapter: entry.currentChapter })}
								</span>
								<span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
									{dateOf(entry.updatedAt)}
								</span>
							</button>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
