import { useMemo, useState } from "react";
import type { StudioState } from "../../hooks/use-studio-state";
import { useTranslator } from "../../hooks/use-translator";
import type { WorkbenchPage } from "../../workbench-pages";
import { coverSeed, elapsedSince, formatCount, percent, wanWords } from "../../workbench-model";
import { Cover } from "../shell/Cover";
import { EmptySheet } from "../shell/EmptySheet";
import { PageHeader } from "../shell/PageHeader";
import { PhaseBadge } from "../shell/PhaseBadge";

const PAGE_SIZE = 9;

// 与 `NovelPhase` 同序：落库的阶段一个都不能漏，否则左栏的筛选会对某些书静默失灵
// （`arc_close` 曾经漏在这里）。
const PHASES = ["briefing", "planning", "drafting", "revising", "arc_close", "completed"] as const;

/**
 * 书库：左边两列筛选，右边一本一行。
 *
 * 筛选与分页都是本页的瞬时状态——工作台不改任何书的事实，只改「现在看哪几本」。
 * 所以这里没有成书、也没有排序器：目录列的永远是索引里那份 `updatedAt`。
 */
export function LibraryPage({
	data,
	onNavigate,
}: {
	data: StudioState;
	onNavigate: (page: WorkbenchPage, chapter?: number) => void;
}) {
	const t = useTranslator();
	const now = Date.now();
	const [genre, setGenre] = useState<string | null>(null);
	const [phase, setPhase] = useState<string | null>(null);
	const [page, setPage] = useState(0);

	const genres = useMemo(() => {
		const seen = new Map<string, number>();
		for (const entry of data.books) {
			const key = (entry.genre ?? "").trim();
			if (key.length > 0) seen.set(key, (seen.get(key) ?? 0) + 1);
		}
		return [...seen.entries()].sort((a, b) => b[1] - a[1]);
	}, [data.books]);

	const filtered = data.books.filter((entry) => {
		if (genre !== null && (entry.genre ?? "").trim() !== genre) return false;
		if (phase !== null && entry.phase !== phase) return false;
		return true;
	});
	const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const current = Math.min(page, pages - 1);
	const rows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
	const words = filtered.reduce((sum, entry) => sum + (entry.words ?? 0), 0);

	const pick = (next: () => void) => {
		setPage(0);
		next();
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col px-7 pb-6 pt-6">
			<PageHeader
				title={t("page.library.title")}
				meta={
					<span className="text-body-sm text-ink-soft">
						{t("library.meta", { count: filtered.length, words: wanWords(words) })}
					</span>
				}
			/>

			<div className="mt-1 flex min-h-0 flex-1 gap-5">
				<aside className="flex w-[188px] shrink-0 flex-col gap-4">
					<div>
						<div className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("library.filter.genre")}
						</div>
						<div className="mt-2 space-y-0.5">
							<button
								type="button"
								onClick={() => pick(() => setGenre(null))}
								className={`flex h-7 w-full items-center gap-2 rounded-control px-2 text-left text-micro ${
									genre === null ? "bg-raised font-semibold text-ink shadow-raise" : "text-ink-soft hover:bg-raised/70"
								}`}
							>
								{t("library.all")}
								<span className="ml-auto font-mono text-[10px] text-ink-faint">{data.books.length}</span>
							</button>
							{genres.map(([name, count]) => (
								<button
									key={name}
									type="button"
									onClick={() => pick(() => setGenre(name))}
									className={`flex h-7 w-full items-center gap-2 rounded-control px-2 text-left text-micro ${
										genre === name ? "bg-raised font-semibold text-ink shadow-raise" : "text-ink-soft hover:bg-raised/70"
									}`}
								>
									<span className="truncate">{name}</span>
									<span className="ml-auto font-mono text-[10px] text-ink-faint">{count}</span>
								</button>
							))}
						</div>
					</div>

					<div>
						<div className="text-micro-up font-semibold uppercase text-ink-faint">
							{t("library.filter.status")}
						</div>
						<div className="mt-2 space-y-0.5">
							{PHASES.map((name) => (
								<button
									key={name}
									type="button"
									onClick={() => pick(() => setPhase(phase === name ? null : name))}
									className={`flex h-7 w-full items-center gap-2 rounded-control px-2 text-left text-micro ${
										phase === name ? "bg-raised font-semibold text-ink shadow-raise" : "text-ink-soft hover:bg-raised/70"
									}`}
								>
									{t(`phase.${name}`)}
									<span className="ml-auto font-mono text-[10px] text-ink-faint">
										{data.books.filter((entry) => entry.phase === name).length}
									</span>
								</button>
							))}
						</div>
					</div>

					<div className="mt-auto rounded-panel bg-inset p-2.5 text-[10px] leading-4 text-ink-soft">
						{t("library.hint")}
					</div>
				</aside>

				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div className="grid shrink-0 grid-cols-[1fr_86px_68px_88px_104px_108px] items-center gap-2 border-b border-line px-2 pb-2 text-micro-up font-semibold uppercase text-ink-faint">
						<span>{t("library.column.book")}</span>
						<span>{t("library.column.stage")}</span>
						<span className="text-right">{t("library.column.chapters")}</span>
						<span className="text-right">{t("library.column.words")}</span>
						<span className="text-right">{t("library.column.updated")}</span>
						<span>{t("library.column.progress")}</span>
					</div>

					{rows.length === 0 ? (
						<div className="flex min-h-0 flex-1 pt-4">
							<EmptySheet icon="icon-[lucide--layers]" title={t("library.empty")} />
						</div>
					) : (
						<ul className="min-h-0 flex-1 overflow-y-auto">
							{rows.map((entry) => {
								const ago = elapsedSince(entry.updatedAt, now);
								return (
									<li key={entry.id}>
										<button
											type="button"
											onClick={() => {
												data.selectBook(entry.id);
												onNavigate("book");
											}}
											className="grid h-16 w-full grid-cols-[1fr_86px_68px_88px_104px_108px] items-center gap-2 border-b border-line-soft px-2 text-left transition-colors hover:bg-raised"
										>
											<span className="flex min-w-0 items-center gap-2.5">
												<Cover {...coverSeed(entry.title)} size="thumb" />
												<span className="min-w-0">
													<span className="flex items-baseline gap-1.5">
														<span className="truncate font-display text-body-sm font-semibold text-ink">
															{entry.title}
														</span>
														<span className="shrink-0 text-[10px] text-ink-faint">
															{entry.genre ?? t("library.card.noGenre")}
														</span>
													</span>
													<span className="mt-0.5 block truncate text-[10px] text-ink-soft">
														{entry.premise ?? t("library.card.noPremise")}
													</span>
												</span>
											</span>
											<span>
												<PhaseBadge phase={entry.phase} />
											</span>
											<span className="text-right font-mono text-micro tabular-nums text-ink">
												{entry.committedCount}/{entry.targetChapters}
											</span>
											<span className="text-right font-mono text-micro tabular-nums text-ink-soft">
												{entry.words ? formatCount(entry.words) : "—"}
											</span>
											<span className="text-right text-[10px] text-ink-soft">
												{ago ? t(ago.key, { count: ago.count }) : "—"}
											</span>
											<span className="flex items-center gap-2">
												<span className="h-[3px] flex-1 overflow-hidden rounded-pill bg-inset">
													<span
														className="block h-full rounded-pill bg-ink/60"
														style={{ width: `${percent(entry.committedCount, entry.targetChapters)}%` }}
													/>
												</span>
												<span className="w-7 shrink-0 text-right font-mono text-[10px] text-ink-faint">
													{percent(entry.committedCount, entry.targetChapters)}%
												</span>
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}

					<div className="flex shrink-0 items-center gap-3 border-t border-line px-2 pt-2 text-[10px] text-ink-faint">
						<button
							type="button"
							onClick={() => setPage(Math.max(0, current - 1))}
							disabled={current === 0}
							className="flex h-6 items-center gap-1 rounded-control border border-line px-2 disabled:opacity-40"
						>
							<span className="icon-[lucide--chevron-left] size-3" />
							{t("library.prev")}
						</button>
						<span className="font-mono">
							{current + 1} / {pages}
						</span>
						<button
							type="button"
							onClick={() => setPage(Math.min(pages - 1, current + 1))}
							disabled={current >= pages - 1}
							className="flex h-6 items-center gap-1 rounded-control border border-line px-2 disabled:opacity-40"
						>
							{t("library.next")}
							<span className="icon-[lucide--chevron-right] size-3" />
						</button>
						<span className="ml-auto">{t("library.footer", { size: PAGE_SIZE })}</span>
					</div>
				</div>
			</div>
		</div>
	);
}
