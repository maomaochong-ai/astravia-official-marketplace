import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { BookIndexEntry } from "../../../repository/manuscript-repository.js";
import { MeterBar } from "../../shared/components/MeterBar.js";
import { PageBar } from "../../shared/components/PageBar.js";
import { Panel } from "../../shared/components/Panel.js";
import { PhaseBadge } from "../../shared/components/PhaseBadge.js";
import { NewBookForm } from "../../studio/components/NewBookForm.js";
import { dateOf, progressPercent } from "../bookshelf-model.js";
import { BookCover } from "./BookCover.js";

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

const PRIMARY_BUTTON =
	"rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
const QUIET_BUTTON =
	"rounded-lg border border-border/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

/**
 * 书架（ADR 0013 §2.2，空态见 ADR 0016，版面见 ADR 0026 §2）。
 *
 * 设计稿的书架是「左边一张正在写的大卡，右边五条其他作品」。照搬到 400px 宽的标签页会挤成
 * 两栏各 180px，所以这里按容器宽度折行：默认单列（主卡在上、其余在下），`lg` 起才并排。
 * 空架仍是三行：这是什么、接下来做什么、一个主按钮；表单点开才出现。
 */
export function LibraryShelf({ books, creating, onOpen, onOpenCatalog, onContinue, onCreate }: LibraryShelfProps) {
	const { t } = useTranslation();
	const [composing, setComposing] = useState(false);

	const primary = books[0] ?? null;
	const others = books.slice(1);

	const actions = (
		<>
			<button type="button" onClick={onOpenCatalog} className={QUIET_BUTTON}>
				{t("shelf.openCatalog")}
			</button>
			<button type="button" onClick={() => setComposing((open) => !open)} className={QUIET_BUTTON}>
				{composing ? t("shelf.cancelNew") : t("shelf.newBook")}
			</button>
		</>
	);

	if (primary === null) {
		return (
			<div className="flex h-full min-h-0 flex-col">
				<PageBar actions={actions}>
					<h1 className="text-lg font-medium text-foreground">{t("shelf.title")}</h1>
					<p className="text-xs text-muted-foreground">{t("shelf.count", { count: 0 })}</p>
				</PageBar>
				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
					{composing ? (
						<div className="mx-auto w-full max-w-md">
							<NewBookForm busy={creating} onCreate={onCreate} />
						</div>
					) : (
						<div className="mx-auto flex max-w-md flex-col items-start gap-3 rounded-2xl border border-dashed border-border/70 px-6 py-8">
							<div className="flex flex-col gap-1.5">
								<p className="text-sm font-medium text-foreground">{t("shelf.emptyTitle")}</p>
								<p className="text-sm text-muted-foreground">{t("shelf.emptyBody")}</p>
							</div>
							<button type="button" onClick={() => setComposing(true)} className={PRIMARY_BUTTON}>
								{t("shelf.newBook")}
							</button>
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<PageBar actions={actions}>
				<h1 className="text-lg font-medium text-foreground">{t("shelf.title")}</h1>
				<p className="text-xs tabular-nums text-muted-foreground">
					{t("shelf.count", { count: books.length })}
				</p>
			</PageBar>

			<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
					<div className="flex min-w-0 flex-1 flex-col gap-4">
						{composing ? <NewBookForm busy={creating} onCreate={onCreate} /> : null}

						<Panel bodyClassName="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start">
							<BookCover
								seed={primary.id}
								title={primary.title}
								caption={t(`phase.${primary.phase}`)}
								variant="headline"
							/>
							<div className="flex min-w-0 flex-1 flex-col gap-2.5">
								<div className="flex flex-wrap items-center gap-2">
									<h2 className="min-w-0 text-base font-medium text-foreground [overflow-wrap:anywhere]">
										{primary.title}
									</h2>
									<PhaseBadge phase={primary.phase} />
								</div>

								<p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
									{primary.premise?.trim() || primary.genre?.trim() || t("library.card.noPremise")}
								</p>

								<div className="flex flex-col gap-1">
									<MeterBar value={progressPercent(primary)} />
									<span className="text-xs tabular-nums text-muted-foreground">
										{t("shelf.progress", {
											done: primary.committedCount,
											total: primary.targetChapters,
										})}
									</span>
								</div>

								<div className="mt-1 flex flex-wrap items-center gap-2">
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
									<span className="text-xs tabular-nums text-muted-foreground">
										{t("library.card.updated", { date: dateOf(primary.updatedAt) })}
									</span>
								</div>
							</div>
						</Panel>
					</div>

					{others.length > 0 ? (
						<aside className="flex w-full flex-col gap-2 lg:w-[300px] lg:shrink-0">
							<Panel title={t("shelf.recent")} bodyClassName="p-1.5">
								<ul className="flex flex-col">
									{others.map((entry) => (
										<li key={entry.id}>
											<button
												type="button"
												onClick={() => onOpen(entry.id)}
												className="flex w-full min-w-0 flex-col gap-1.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60"
											>
												<span className="flex min-w-0 items-baseline gap-2">
													<span className="min-w-0 flex-1 truncate text-sm text-foreground">
														{entry.title}
													</span>
													<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
														{dateOf(entry.updatedAt)}
													</span>
												</span>
												<span className="flex min-w-0 items-center gap-2">
													<MeterBar value={progressPercent(entry)} className="h-0.5" />
													<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
														{entry.committedCount}/{entry.targetChapters}
													</span>
												</span>
											</button>
										</li>
									))}
								</ul>
							</Panel>
						</aside>
					) : null}
				</div>
			</div>
		</div>
	);
}
