import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";

import type { BookIndexEntry } from "../../../repository/manuscript-repository.js";
import { MeterBar } from "../../shared/components/MeterBar.js";
import { PageBar, PAGE_META, PAGE_TITLE } from "../../shared/components/PageBar.js";
import { PhaseBadge } from "../../shared/components/PhaseBadge.js";
import { NewBookForm } from "../../studio/components/NewBookForm.js";
import { BookCover } from "./BookCover.js";
import { dateOf, progressPercent, recentBooks, sortedByRecent } from "../bookshelf-model.js";

interface LibraryShelfProps {
	books: BookIndexEntry[];
	creating: boolean;
	onOpen: (bookId: string) => void;
	onOpenCatalog: () => void;
	onContinue: (bookId: string, chapter: number) => void;
	onCreate: (input: {
		title: string;
		genre: string;
		premise: string;
		targetChapters: number;
	}) => Promise<boolean>;
	/** 「看运行台」：有书才能进；没有回调就不渲染那颗按钮。 */
	onOpenConsole?: (bookId: string) => void;
}

const PRIMARY_BUTTON =
	"rounded-[9px] bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40";
const QUIET_BUTTON =
	"rounded-[9px] border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40";

const CARD = "rounded-[13px] border border-border/60 bg-card shadow-sm";

/**
 * 书架（ADR 0013 §2.2 / 0020 §1，版面见设计稿 `shelf` 帧，ADR 0027 §5）。
 *
 * 设计稿是「一张大纸 + 右栏书目」：大纸上左边封面、右边书名与进度，纸内再压一块
 * 「正在写」的深色小卡；右栏是其余作品的一列细行。标签页窄，所以右栏在 `xl` 才独立成列，
 * 其余宽度落到主卡下面——顺序仍是「在读的这本 → 其他」。
 *
 * 设计稿「刚落盘」那一块列的是工具事件，插件在书架这一层只有索引，没有事件流；
 * 所以这里列的是**最近更新的四本**（书名 + 阶段 + 落盘日期），有据可查。
 */
export function LibraryShelf({
	books,
	creating,
	onOpen,
	onOpenCatalog,
	onContinue,
	onCreate,
	onOpenConsole,
}: LibraryShelfProps) {
	const { t } = useTranslation();
	const [creatingOpen, setCreatingOpen] = useState(false);

	const primary = books[0] ?? null;
	const others = books.slice(1);
	const recent = recentBooks(sortedByRecent(books), 4);
	const active = books.filter((book) => book.phase !== "completed").length;
	const totalWords = books.reduce((sum, book) => sum + (book.words ?? 0), 0);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageBar
				actions={
					<>
						<button type="button" onClick={onOpenCatalog} className={QUIET_BUTTON}>
							{t("shelf.openCatalog")}
						</button>
						<button
							type="button"
							onClick={() => setCreatingOpen((open) => !open)}
							className={creatingOpen ? QUIET_BUTTON : PRIMARY_BUTTON}
						>
							{creatingOpen ? t("shelf.cancelNew") : t("shelf.newBook")}
						</button>
					</>
				}
			>
				<h1 className={PAGE_TITLE}>{t("shelf.title")}</h1>
				<p className={PAGE_META}>
					<span className="tabular-nums">{t("shelf.meta", { active, total: books.length })}</span>
					{totalWords > 0 ? <span className="tabular-nums">{t("board.words", { count: totalWords })}</span> : null}
				</p>
			</PageBar>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
				{creatingOpen ? (
					<div className={`${CARD} mb-4 p-4`}>
						<NewBookForm
							busy={creating}
							onCreate={async (input) => {
								const created = await onCreate(input);
								if (created) setCreatingOpen(false);
								return created;
							}}
						/>
					</div>
				) : null}

				{primary === null ? (
					<div className={`${CARD} flex min-h-[220px] flex-col items-center justify-center gap-3 border-dashed px-6 py-10 text-center`}>
						<p className="font-serif text-[18px] font-semibold text-foreground">{t("shelf.emptyTitle")}</p>
						<p className="max-w-sm text-[12px] leading-relaxed text-muted-foreground">{t("shelf.emptyBody")}</p>
						<button type="button" onClick={() => setCreatingOpen(true)} className={PRIMARY_BUTTON}>
							{t("shelf.newBook")}
						</button>
					</div>
				) : (
					<div className="flex flex-col gap-4 xl:flex-row xl:items-start">
						<section className={`${CARD} flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5`}>
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
								<BookCover
									seed={primary.id}
									title={primary.title}
									size="shelf"
									caption={t(`phase.${primary.phase}`)}
								/>
								<div className="flex min-w-0 flex-1 flex-col gap-2">
									<span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
										{t("shelf.nowWriting")}
									</span>
									<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
										<h2 className="min-w-0 font-serif text-[26px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">
											{primary.title}
										</h2>
										<PhaseBadge phase={primary.phase} />
									</div>
									<p className="text-[11px] text-muted-foreground">
										{primary.genre?.trim() || t("library.card.noGenre")}
										{primary.targetChapters > 0 ? ` · ${t("book.indexCount", { count: primary.targetChapters })}` : ""}
										{primary.words ? ` · ${t("board.words", { count: primary.words })}` : ""}
									</p>
									<p className="line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
										{primary.premise?.trim() || t("library.card.noPremise")}
									</p>
									<div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
										<button type="button" onClick={() => onOpen(primary.id)} className={PRIMARY_BUTTON}>
											{t("shelf.openBook")}
										</button>
										<button
											type="button"
											onClick={() => onContinue(primary.id, primary.currentChapter)}
											className={QUIET_BUTTON}
										>
											{t("shelf.continueAt", { chapter: primary.currentChapter })}
										</button>
										{onOpenConsole ? (
											<button
												type="button"
												onClick={() => onOpenConsole(primary.id)}
												className={`${QUIET_BUTTON} ml-auto font-mono`}
											>
												{t("shelf.openConsole")}
											</button>
										) : null}
									</div>
								</div>
							</div>

							<div className="rounded-[11px] bg-muted/60 p-3">
								<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
									<span className="text-[11px] font-medium text-foreground">{t("shelf.progressTitle")}</span>
									<span className="font-mono text-[11px] tabular-nums text-muted-foreground">
										{primary.committedCount} / {primary.targetChapters}
									</span>
								</div>
								<MeterBar value={progressPercent(primary)} className="mt-2 h-[5px]" />
								<p className="mt-2 text-[10px] text-muted-foreground">
									{t("library.card.updated", { date: dateOf(primary.updatedAt) })}
								</p>
							</div>
						</section>

						<div className="flex w-full shrink-0 flex-col gap-3 xl:w-[330px]">
							<section className={`${CARD} p-2`}>
								<header className="flex items-baseline justify-between gap-2 px-2 pb-1.5 pt-1">
									<span className="text-[11px] font-medium text-foreground">
										{t("shelf.live")}
									</span>
									<span className="font-mono text-[10px] text-muted-foreground">{recent.length}</span>
								</header>
								<ul className="flex flex-col">
									{recent.map((entry) => (
										<li key={entry.id}>
											<button
												type="button"
												onClick={() => onOpen(entry.id)}
												className="flex w-full items-center gap-2 rounded-[9px] px-1.5 py-[7px] text-left transition-colors hover:bg-muted/60"
											>
												<span className="w-9 shrink-0 font-mono text-[9px] text-muted-foreground">
													{dateOf(entry.updatedAt)}
												</span>
												<span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{entry.title}</span>
												<span className="shrink-0 font-mono text-[9px] text-muted-foreground">
													{entry.committedCount}/{entry.targetChapters}
												</span>
											</button>
										</li>
									))}
								</ul>
							</section>

							{others.length > 0 ? (
								<section className={`${CARD} p-2`}>
									<header className="flex items-baseline justify-between gap-2 px-2 pb-1.5 pt-1">
										<span className="text-[11px] font-medium text-foreground">
											{t("shelf.others", { count: others.length })}
										</span>
										<button
											type="button"
											onClick={onOpenCatalog}
											className="text-[10px] text-primary transition-opacity hover:opacity-80"
										>
											{t("shelf.openCatalog")} →
										</button>
									</header>
									<ul className="flex flex-col">
										{others.map((entry) => {
											const percent = progressPercent(entry);
											return (
												<li key={entry.id}>
													<button
														type="button"
														onClick={() => onOpen(entry.id)}
														className="flex w-full items-center gap-2.5 rounded-[11px] px-2 py-2 text-left transition-colors hover:bg-muted/60"
													>
														<BookCover seed={entry.id} title={entry.title} size="mini" />
														<span className="flex min-w-0 flex-1 flex-col gap-1">
															<span className="flex min-w-0 items-baseline gap-1.5">
																<span className="min-w-0 truncate text-[12px] font-semibold text-foreground">
																	{entry.title}
																</span>
																<PhaseBadge phase={entry.phase} />
															</span>
															<span className="flex items-center gap-2">
																<MeterBar value={percent} className="h-[2px]" />
																<span className="shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
																	{entry.committedCount}/{entry.targetChapters}
																</span>
															</span>
														</span>
													</button>
												</li>
											);
										})}
									</ul>
								</section>
							) : null}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
